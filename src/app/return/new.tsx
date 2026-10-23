import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Button, Choice, Field, Screen, T } from '@/components/ui';
import { createReturn, getInvoice, listReturnableInvoices } from '@/db';
import type { Invoice, InvoiceItem } from '@/db/types';
import { useI18n } from '@/i18n';
import { errorKey } from '@/lib/errors';
import { formatMoney, formatQty, localizedName, num, round2 } from '@/lib/format';
import { splitRefund } from '@/lib/pricing';
import { useSession } from '@/state/session';
import { colors, fonts } from '@/theme';

export default function NewReturn() {
  const params = useLocalSearchParams<{ invoiceId?: string }>();
  const { t, lang } = useI18n();
  const { user, notify } = useSession();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [bills, setBills] = useState<Invoice[]>([]);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [qty, setQty] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<'cash' | 'upi' | 'credit'>('cash');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listReturnableInvoices(query).then(setBills).catch(() => undefined);
  }, [query]);

  const open = async (id: string) => {
    const found = await getInvoice(id);
    if (!found) return;
    setInvoice(found.invoice);
    setItems(found.items);
    setQty({});
  };

  useEffect(() => {
    if (params.invoiceId) void open(params.invoiceId);
  }, [params.invoiceId]);

  const chosen = items
    .map((item) => ({ item, qty: num(qty[item.id] ?? '') }))
    .filter((line) => line.qty > 0);
  const total = round2(chosen.reduce((sum, line) => sum + (line.item.qty ? (line.item.total / line.item.qty) * line.qty : 0), 0));
  const split = useMemo(() => (invoice ? splitRefund(invoice.due, total, mode) : null), [invoice, total, mode]);

  const save = async () => {
    if (!user || !invoice) return;
    setBusy(true);
    try {
      await createReturn({
        invoiceId: invoice.id,
        lines: chosen.map((line) => ({ invoiceItemId: line.item.id, qty: line.qty })),
        refundMode: mode,
        note,
        user,
      });
      notify();
      router.back();
    } catch (error) {
      Alert.alert(t('failedTitle'), t(errorKey(error)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll>
      <Stack.Screen options={{ title: t('newReturn') }} />
      {!invoice ? (
        <>
          <Field label={t('searchBills')} value={query} onChangeText={setQuery} />
          {bills.map((bill) => (
            <Pressable key={bill.id} onPress={() => open(bill.id)} style={styles.row}>
              <T weight="semi">{bill.number}</T>
              <T style={styles.muted}>{bill.partyName || t('walkIn')} · {formatMoney(bill.total)}</T>
            </Pressable>
          ))}
        </>
      ) : (
        <>
          <T weight="bold">{invoice.number}</T>
          <T style={styles.muted}>{invoice.partyName || t('walkIn')}</T>
          {items.map((item) => {
            const left = round2(item.qty - item.returnedQty);
            if (left <= 0) return null;
            return (
              <View key={item.id} style={styles.line}>
                <T weight="semi">{localizedName(item, lang)}</T>
                <T style={styles.muted}>{t('qtyLeft', { count: formatQty(left) })}</T>
                <TextInput
                  value={qty[item.id] ?? ''}
                  onChangeText={(value) => setQty((current) => ({ ...current, [item.id]: value }))}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor="#8A978F"
                  style={styles.input}
                />
                <Pressable onPress={() => setQty((current) => ({ ...current, [item.id]: String(left) }))}>
                  <T style={styles.link}>{t('fullReturn')}</T>
                </Pressable>
              </View>
            );
          })}
          <Choice
            options={[
              { id: 'cash', label: t('cashRefund') },
              { id: 'upi', label: t('upiRefund') },
              { id: 'credit', label: t('creditNote') },
            ]}
            value={mode}
            onChange={(id) => setMode(id as 'cash' | 'upi' | 'credit')}
          />
          <Field label={t('reason')} value={note} onChangeText={setNote} />
          <T weight="bold">{t('preview')} {formatMoney(total)}</T>
          {split ? (
            <>
              <T style={styles.muted}>{t('reduceDue')} {formatMoney(split.dueCut)}</T>
              <T style={styles.muted}>{t('willRefund')} {formatMoney(split.payout)}</T>
            </>
          ) : null}
          <Button label={busy ? t('working') : t('saveReturn')} onPress={save} disabled={busy} />
          <Button label={t('selectBill')} kind="ghost" onPress={() => setInvoice(null)} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { padding: 12, borderRadius: 14, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, gap: 2 },
  line: { padding: 12, borderRadius: 14, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, gap: 6 },
  muted: { color: colors.muted },
  input: { height: 44, borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingHorizontal: 10, fontFamily: fonts.regular, color: colors.ink },
  link: { color: colors.greenDark },
});

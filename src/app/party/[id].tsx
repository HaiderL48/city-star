import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Linking, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { Button, Choice, Field, Screen, T, confirm } from '@/components/ui';
import { deleteParty, dueInvoices, duePurchases, getParty, listLedger, paySupplier, receivePartyPayment } from '@/db';
import type { Invoice, LedgerEntry, Party, Purchase } from '@/db/types';
import { useI18n } from '@/i18n';
import { errorKey } from '@/lib/errors';
import { formatDate, formatMoney, num } from '@/lib/format';
import { ledgerLabel } from '@/print/model';
import { useSession } from '@/state/session';
import { colors } from '@/theme';

export default function PartyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, lang } = useI18n();
  const { user, notify } = useSession();
  const router = useRouter();
  const [party, setParty] = useState<Party | null>(null);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [bills, setBills] = useState<Invoice[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState<'cash' | 'upi' | 'card'>('cash');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const found = await getParty(id);
    setParty(found);
    if (!found) return;
    setEntries(await listLedger(id));
    setBills(found.kind === 'customer' ? await dueInvoices(id) : []);
    setPurchases(found.kind === 'supplier' ? await duePurchases(id) : []);
  }, [id]);

  useFocusEffect(useCallback(() => { load().catch(() => undefined); }, [load]));

  if (!party || !user) {
    return <Screen><Stack.Screen options={{ title: t('parties') }} /><T>{t('partyMissing')}</T></Screen>;
  }

  const pay = async () => {
    setBusy(true);
    try {
      if (party.kind === 'customer') await receivePartyPayment(party.id, num(amount), mode, user);
      else await paySupplier(party.id, num(amount), mode, user);
      setAmount('');
      notify();
      await load();
    } catch (error) {
      Alert.alert(t('failedTitle'), t(errorKey(error)));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    const ok = await confirm(t('deleteParty'), t('deleteConfirm'), t('delete'), t('cancel'));
    if (!ok) return;
    try {
      await deleteParty(party.id);
      notify();
      router.back();
    } catch (error) {
      Alert.alert(t('cannotDelete'), t(errorKey(error)));
    }
  };

  return (
    <Screen scroll>
      <Stack.Screen options={{ title: party.name }} />
      <T weight="bold" style={styles.big}>{formatMoney(Math.abs(party.balance))}</T>
      <T style={styles.muted}>{party.balance < -0.001 ? t('advance') : party.kind === 'customer' ? t('theyOwe') : t('youOwe')}</T>
      <T>{party.phone}</T>
      <T style={styles.muted}>{party.address}</T>
      {party.phone ? <Button label={t('call')} kind="secondary" onPress={() => Linking.openURL(`tel:${party.phone}`)} /> : null}
      <Button label={t('edit')} kind="ghost" onPress={() => router.push({ pathname: '/party/form', params: { id: party.id } })} />
      <T weight="bold">{party.kind === 'customer' ? t('receivePayment') : t('paySupplier')}</T>
      <T style={styles.muted}>{party.kind === 'customer' ? t('receiveHelp') : t('payHelp')}</T>
      <Field label={t('amount')} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
      <Choice options={(['cash', 'upi', 'card'] as const).map((item) => ({ id: item, label: t(item) }))} value={mode} onChange={(value) => setMode(value as 'cash' | 'upi' | 'card')} />
      <Button label={busy ? t('working') : t('recordPayment')} onPress={pay} disabled={busy} />
      <T weight="bold">{party.kind === 'customer' ? t('billDue') : t('purchaseDue')}</T>
      {party.kind === 'customer' && bills.length === 0 ? <T style={styles.muted}>{t('noDue')}</T> : null}
      {bills.map((bill) => (
        <View key={bill.id} style={styles.line}>
          <T weight="semi">{bill.number}</T>
          <T>{formatMoney(bill.due)} · {formatDate(bill.date, lang)}</T>
        </View>
      ))}
      {purchases.map((bill) => (
        <View key={bill.id} style={styles.line}>
          <T weight="semi">{bill.number}</T>
          <T>{formatMoney(bill.due)} · {formatDate(bill.date, lang)}</T>
        </View>
      ))}
      <T weight="bold">{t('statement')}</T>
      {entries.length === 0 ? <T style={styles.muted}>{t('noEntries')}</T> : null}
      {entries.map((entry) => {
        const effect = party.kind === 'customer' ? entry.debit - entry.credit : entry.credit - entry.debit;
        return (
          <View key={entry.id} style={styles.line}>
            <T weight="semi">{ledgerLabel(entry.kind, t)}</T>
            <T style={styles.muted}>{formatDate(entry.date, lang)} {entry.note}</T>
            <T weight="bold" style={{ color: effect >= 0 ? colors.red : colors.greenDark }}>{formatMoney(effect)}</T>
          </View>
        );
      })}
      <Button label={t('deleteParty')} kind="danger" onPress={remove} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  big: { fontSize: 32 },
  muted: { color: colors.muted },
  line: { padding: 12, borderRadius: 14, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, gap: 2 },
});

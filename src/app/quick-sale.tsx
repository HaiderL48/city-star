import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Button, Choice, Dock, Field, Screen, T } from '@/components/ui';
import { createSale, saveParty } from '@/db';
import type { PayMode } from '@/db/types';
import { useI18n } from '@/i18n';
import { errorKey, fail } from '@/lib/errors';
import { formatMoney, num } from '@/lib/format';
import { useSession } from '@/state/session';
import { colors } from '@/theme';

const MODES: PayMode[] = ['cash', 'upi', 'card', 'credit'];

export default function QuickSaleScreen() {
  const { t } = useI18n();
  const { settings, user, notify } = useSession();
  const router = useRouter();
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [itemName, setItemName] = useState('');
  const [qty, setQty] = useState('1');
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState<PayMode>('cash');
  const [received, setReceived] = useState('');
  const [paidNow, setPaidNow] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const quantity = Math.max(num(qty), 0);
  const total = num(amount);
  const rate = quantity > 0 ? total / quantity : 0;
  const tendered = received === '' ? total : num(received);
  const change = mode === 'cash' ? tendered - total : 0;

  const submit = async (print: boolean) => {
    if (!user || !settings) return;
    setBusy(true);
    try {
      const name = itemName.trim();
      if (!name) fail('name_required');
      if (quantity <= 0) fail('qty_required');
      if (total <= 0) fail('invalid_amount');

      let partyId: string | null = null;
      const guestName = customerName.trim();
      const guestPhone = customerPhone.trim();
      if (mode === 'credit') {
        if (!guestName) fail('customer_required');
        partyId = await saveParty({ kind: 'customer', name: guestName, phone: guestPhone, address: '', gstin: '' });
      }

      const id = await createSale({
        partyId,
        guestName: partyId ? undefined : guestName,
        guestPhone: partyId ? undefined : guestPhone,
        lines: [
          {
            productId: null,
            name,
            nameGu: '',
            unit: 'pcs',
            qty: quantity,
            rate,
            gstRate: 0,
            purchasePrice: 0,
          },
        ],
        discount: 0,
        paymentMode: mode,
        paid: num(paidNow),
        received: mode === 'cash' ? tendered : total,
        note,
        user,
        taxInclusive: settings.taxInclusive,
      });
      notify();
      router.replace({ pathname: '/invoice/[id]', params: { id, action: print ? 'print' : '' } });
    } catch (error) {
      Alert.alert(t('failedTitle'), t(errorKey(error)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: t('quickSale') }} />
      <Screen scroll pad={false}>
        <View style={styles.body}>
          <T style={styles.help}>{t('quickSaleHelp')}</T>

          <T weight="bold" style={styles.h}>
            {t('customerOnBill')}
          </T>
          <Field label={t('customerName')} value={customerName} onChangeText={setCustomerName} placeholder={t('walkIn')} />
          <Field label={t('customerPhone')} value={customerPhone} onChangeText={setCustomerPhone} keyboardType="phone-pad" />
          <T style={styles.muted}>{mode === 'credit' ? t('customerRequired') : t('customerOptional')}</T>

          <T weight="bold" style={styles.h}>
            {t('itemName')}
          </T>
          <Field label={t('itemName')} value={itemName} onChangeText={setItemName} />
          <View style={styles.row}>
            <View style={styles.flex}>
              <Field label={t('qty')} value={qty} onChangeText={setQty} keyboardType="decimal-pad" />
            </View>
            <View style={styles.flex}>
              <Field label={t('saleAmount')} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
            </View>
          </View>
          {total > 0 && quantity > 0 ? (
            <T style={styles.muted}>
              {quantity} × {formatMoney(rate)} = {formatMoney(total)}
            </T>
          ) : null}

          <T weight="bold" style={styles.h}>
            {t('paymentMode')}
          </T>
          <Choice options={MODES.map((item) => ({ id: item, label: t(item) }))} value={mode} onChange={(id) => setMode(id as PayMode)} />
          {mode === 'cash' ? (
            <Field label={t('received')} value={received} onChangeText={setReceived} keyboardType="decimal-pad" placeholder={total ? formatMoney(total) : undefined} />
          ) : null}
          {mode === 'credit' ? (
            <Field label={t('receivedNow')} value={paidNow} onChangeText={setPaidNow} keyboardType="decimal-pad" placeholder="0" />
          ) : null}
          <Field label={t('noteBill')} value={note} onChangeText={setNote} />

          <View style={styles.summary}>
            <T weight="bold" style={styles.total}>
              {formatMoney(total)}
            </T>
            {mode === 'cash' && total > 0 && received !== '' ? (
              <T style={change >= -0.001 ? styles.ok : styles.bad}>
                {change >= -0.001 ? t('giveChange', { amount: formatMoney(Math.max(change, 0)) }) : t('shortCash', { amount: formatMoney(Math.abs(change)) })}
              </T>
            ) : null}
          </View>
        </View>
      </Screen>
      <Dock safe>
        <Button label={busy ? t('working') : t('payAndPrint')} onPress={() => submit(true)} disabled={busy} icon="print-outline" />
        <Button label={t('saveOnly')} kind="secondary" onPress={() => submit(false)} disabled={busy} />
      </Dock>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  body: { padding: 16, gap: 10 },
  help: { color: colors.muted },
  h: { fontSize: 18, marginTop: 6 },
  muted: { color: colors.muted, fontSize: 13 },
  row: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
  summary: { gap: 4, paddingVertical: 8 },
  total: { fontSize: 28 },
  ok: { color: colors.greenDark },
  bad: { color: colors.red },
});

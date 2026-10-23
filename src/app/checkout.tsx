import { Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Button, Choice, Dock, Field, Screen, T } from '@/components/ui';
import { createSale, listParties, saveParty } from '@/db';
import type { Party, PayMode } from '@/db/types';
import { useI18n } from '@/i18n';
import { errorKey, fail } from '@/lib/errors';
import { formatMoney, formatQty, localizedName, num } from '@/lib/format';
import { computeBill } from '@/lib/pricing';
import { useCart } from '@/state/cart';
import { useSession } from '@/state/session';
import { listProducts } from '@/db';
import { colors, fonts } from '@/theme';
import { useEffect } from 'react';

const MODES: PayMode[] = ['cash', 'upi', 'card', 'credit'];

export default function CheckoutScreen() {
  const { t, lang } = useI18n();
  const { settings, user, notify } = useSession();
  const cart = useCart();
  const router = useRouter();
  const [parties, setParties] = useState<Party[]>([]);
  const [partyId, setPartyId] = useState<string | null>(null);
  const [mode, setMode] = useState<PayMode>('cash');
  const [received, setReceived] = useState('');
  const [paidNow, setPaidNow] = useState('');
  const [note, setNote] = useState('');
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [customOpen, setCustomOpen] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customRate, setCustomRate] = useState('');
  const [busy, setBusy] = useState(false);
  const [stock, setStock] = useState<Record<string, number>>({});

  useEffect(() => {
    listParties('customer').then(setParties).catch(() => undefined);
    listProducts().then((products) => {
      setStock(Object.fromEntries(products.map((product) => [product.id, product.stock])));
    });
  }, []);

  const bill = useMemo(
    () => computeBill(cart.lines, cart.discount, settings?.taxInclusive !== false),
    [cart.lines, cart.discount, settings?.taxInclusive],
  );
  const tendered = num(received);
  const change = mode === 'cash' ? tendered - bill.total : 0;
  const party = parties.find((item) => item.id === partyId) ?? null;
  const filtered = parties.filter((item) => item.name.toLowerCase().includes(query.trim().toLowerCase()));

  const saveCustomer = async () => {
    const id = await saveParty({ kind: 'customer', name: newName, phone: newPhone, address: '', gstin: '' });
    const next = await listParties('customer');
    setParties(next);
    setPartyId(id);
    setAdding(false);
    setNewName('');
    setNewPhone('');
  };

  const save = async (action?: 'print' | 'whatsapp') => {
    if (!user || !settings) return;
    const short = cart.lines.some((line) => line.productId && (stock[line.productId] ?? 0) + 0.0001 < line.qty);
    if (short) {
      const go = await new Promise<boolean>((resolve) => {
        Alert.alert(t('lowStock'), t('lowWarning'), [
          { text: t('cancel'), style: 'cancel', onPress: () => resolve(false) },
          { text: t('stillSave'), onPress: () => resolve(true) },
        ]);
      });
      if (!go) return;
    }
    setBusy(true);
    try {
      if (mode === 'credit' && !partyId) fail('customer_required');
      const id = await createSale({
        partyId,
        lines: cart.lines,
        discount: cart.discount,
        paymentMode: mode,
        paid: num(paidNow),
        received: mode === 'cash' ? (received === '' ? bill.total : tendered) : bill.total,
        note,
        user,
        taxInclusive: settings.taxInclusive,
      });
      cart.clear();
      notify();
      router.replace({ pathname: '/invoice/[id]', params: { id, action: action ?? '' } });
    } catch (error) {
      Alert.alert(t('failedTitle'), t(errorKey(error)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: t('charge') }} />
      <Screen scroll pad={false}>
        <View style={styles.body}>
          <T weight="bold" style={styles.h}>{t('inBill')}</T>
          {cart.lines.map((line, index) => {
            const priced = bill.items[index];
            return (
              <View key={line.key} style={styles.line}>
                <View style={styles.row}>
                  <T weight="semi" style={styles.flex}>{localizedName(line, lang)}</T>
                  <Pressable onPress={() => cart.remove(line.key)}>
                    <T style={styles.link}>{t('remove')}</T>
                  </Pressable>
                </View>
                <View style={styles.row}>
                  <TextInput
                    value={String(line.qty)}
                    onChangeText={(value) => cart.update(line.key, { qty: num(value) })}
                    keyboardType="decimal-pad"
                    style={styles.small}
                  />
                  <TextInput
                    value={String(line.rate)}
                    onChangeText={(value) => cart.update(line.key, { rate: num(value) })}
                    keyboardType="decimal-pad"
                    style={styles.small}
                  />
                  <T weight="bold">{formatMoney(priced?.total ?? 0)}</T>
                </View>
                <T style={styles.muted}>{formatQty(line.qty)} × {formatMoney(line.rate)}</T>
              </View>
            );
          })}
          <Pressable onPress={() => setCustomOpen((value) => !value)}>
            <T weight="semi" style={styles.link}>{t('customItem')}</T>
          </Pressable>
          {customOpen ? (
            <View style={styles.line}>
              <Field label={t('itemName')} value={customName} onChangeText={setCustomName} />
              <Field label={t('rate')} value={customRate} onChangeText={setCustomRate} keyboardType="decimal-pad" />
              <Button
                label={t('add')}
                kind="secondary"
                onPress={() => {
                  if (!customName.trim() || num(customRate) <= 0) return;
                  cart.addCustom({ name: customName.trim(), nameGu: '', unit: 'pcs', qty: 1, rate: num(customRate), gstRate: 0, purchasePrice: 0 });
                  setCustomName('');
                  setCustomRate('');
                  setCustomOpen(false);
                }}
              />
            </View>
          ) : null}

          <T weight="bold" style={styles.h}>{t('customerOnBill')}</T>
          <Pressable onPress={() => setPartyId(null)} style={[styles.party, !partyId && styles.partyOn]}>
            <T weight="semi">{t('walkIn')}</T>
          </Pressable>
          <TextInput value={query} onChangeText={setQuery} placeholder={t('searchCustomer')} placeholderTextColor="#8A978F" style={styles.search} />
          {filtered.slice(0, 6).map((item) => (
            <Pressable key={item.id} onPress={() => setPartyId(item.id)} style={[styles.party, partyId === item.id && styles.partyOn]}>
              <T weight="semi">{item.name}</T>
              <T style={styles.muted}>{item.phone}</T>
            </Pressable>
          ))}
          <Pressable onPress={() => setAdding((value) => !value)}>
            <T weight="semi" style={styles.link}>{t('addCustomer')}</T>
          </Pressable>
          {adding ? (
            <View style={styles.line}>
              <Field label={t('name')} value={newName} onChangeText={setNewName} />
              <Field label={t('phone')} value={newPhone} onChangeText={setNewPhone} keyboardType="phone-pad" />
              <Button label={t('createAndUse')} kind="secondary" onPress={() => saveCustomer().catch((error) => Alert.alert(t('failedTitle'), t(errorKey(error))))} />
            </View>
          ) : null}

          <Field label={t('billDiscount')} value={String(cart.discount || '')} onChangeText={(value) => cart.setDiscount(num(value))} keyboardType="decimal-pad" />
          <T weight="bold" style={styles.h}>{t('paymentMode')}</T>
          <Choice options={MODES.map((item) => ({ id: item, label: t(item) }))} value={mode} onChange={(id) => setMode(id as PayMode)} />
          {mode === 'cash' ? (
            <Field label={t('received')} value={received} onChangeText={setReceived} keyboardType="decimal-pad" placeholder={formatMoney(bill.total)} />
          ) : null}
          {mode === 'credit' ? (
            <>
              <T style={styles.muted}>{t('creditPaidHelp')}</T>
              <Field label={t('receivedNow')} value={paidNow} onChangeText={setPaidNow} keyboardType="decimal-pad" placeholder="0" />
            </>
          ) : null}
          <Field label={t('noteBill')} value={note} onChangeText={setNote} />
          <View style={styles.summary}>
            <Row label={t('subtotal')} value={formatMoney(bill.subtotal)} />
            <Row label={t('gst')} value={formatMoney(bill.tax)} />
            <Row label={t('discount')} value={formatMoney(bill.discount)} />
            <Row label={t('grandTotal')} value={formatMoney(bill.total)} strong />
            {mode === 'cash' && received !== '' ? (
              <T style={change >= -0.001 ? styles.ok : styles.bad}>
                {change >= -0.001 ? t('giveChange', { amount: formatMoney(Math.max(change, 0)) }) : t('shortCash', { amount: formatMoney(Math.abs(change)) })}
              </T>
            ) : null}
            {party ? <T style={styles.muted}>{party.name}</T> : null}
          </View>
        </View>
      </Screen>
      <Dock safe>
        <Button label={busy ? t('working') : t('saveOnly')} onPress={() => save()} disabled={busy} />
        <View style={styles.row}>
          <View style={styles.flex}><Button label={t('printReceipt')} kind="secondary" onPress={() => save('print')} disabled={busy} /></View>
          <View style={styles.flex}><Button label={t('sendWhatsapp')} kind="secondary" onPress={() => save('whatsapp')} disabled={busy} /></View>
        </View>
      </Dock>
    </View>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <T weight={strong ? 'bold' : 'regular'}>{label}</T>
      <T weight={strong ? 'bold' : 'semi'}>{value}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  body: { padding: 16, gap: 10 },
  h: { fontSize: 18, marginTop: 6 },
  line: { backgroundColor: colors.white, borderRadius: 16, borderWidth: 1, borderColor: colors.line, padding: 12, gap: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
  small: { width: 72, height: 40, borderWidth: 1, borderColor: colors.line, borderRadius: 10, textAlign: 'center', fontFamily: fonts.regular, color: colors.ink },
  muted: { color: colors.muted, fontSize: 13 },
  link: { color: colors.greenDark },
  party: { padding: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  partyOn: { borderColor: colors.green, backgroundColor: colors.greenSoft },
  search: { height: 44, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, paddingHorizontal: 12, fontFamily: fonts.regular, color: colors.ink },
  summary: { gap: 6, paddingBottom: 12 },
  ok: { color: colors.greenDark },
  bad: { color: colors.red },
});

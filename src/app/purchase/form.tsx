import { Stack, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Button, Choice, Field, Screen, T } from '@/components/ui';
import { createPurchase, listParties, listProducts } from '@/db';
import type { Party, PayMode, Product } from '@/db/types';
import { useI18n } from '@/i18n';
import { errorKey } from '@/lib/errors';
import { formatMoney, localizedName, num } from '@/lib/format';
import { computeBill } from '@/lib/pricing';
import { useSession } from '@/state/session';
import { colors } from '@/theme';

type Line = { productId: string; qty: string; rate: string };

export default function PurchaseForm() {
  const { t, lang } = useI18n();
  const { settings, user, notify } = useSession();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [partyId, setPartyId] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [mode, setMode] = useState<PayMode>('cash');
  const [paid, setPaid] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listProducts().then(setProducts);
    listParties('supplier').then(setParties);
  }, []);

  const priced = useMemo(() => {
    const input = lines
      .map((line) => {
        const product = products.find((item) => item.id === line.productId);
        return product ? { qty: num(line.qty), rate: num(line.rate), gstRate: product.gstRate } : null;
      })
      .filter((line): line is { qty: number; rate: number; gstRate: number } => Boolean(line && line.qty > 0));
    return computeBill(input, 0, settings?.taxInclusive !== false);
  }, [lines, products, settings?.taxInclusive]);

  const add = (product: Product) => {
    setLines((current) => {
      if (current.some((line) => line.productId === product.id)) return current;
      return [...current, { productId: product.id, qty: '1', rate: String(product.purchasePrice || product.salePrice) }];
    });
  };

  const save = async () => {
    if (!user || !settings) return;
    setBusy(true);
    try {
      await createPurchase({
        partyId,
        lines: lines.map((line) => ({ productId: line.productId, qty: num(line.qty), rate: num(line.rate) })),
        paymentMode: mode,
        paid: num(paid),
        note,
        user,
        taxInclusive: settings.taxInclusive,
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
      <Stack.Screen options={{ title: t('newPurchase') }} />
      <T weight="semi">{t('supplier')}</T>
      <Pressable onPress={() => setPartyId(null)} style={[styles.party, !partyId && styles.on]}><T>{t('none')}</T></Pressable>
      {parties.map((party) => (
        <Pressable key={party.id} onPress={() => setPartyId(party.id)} style={[styles.party, partyId === party.id && styles.on]}>
          <T weight="semi">{party.name}</T>
        </Pressable>
      ))}
      <T style={styles.muted}>{t('supplierOptional')}</T>
      <T weight="bold">{t('pickItems')}</T>
      <View style={styles.chips}>
        {products.map((product) => (
          <Pressable key={product.id} onPress={() => add(product)} style={styles.chip}>
            <T>{localizedName(product, lang)}</T>
          </Pressable>
        ))}
      </View>
      {lines.map((line) => {
        const product = products.find((item) => item.id === line.productId);
        return (
          <View key={line.productId} style={styles.line}>
            <T weight="semi">{product ? localizedName(product, lang) : line.productId}</T>
            <Field label={t('qty')} value={line.qty} onChangeText={(value) => setLines((current) => current.map((item) => item.productId === line.productId ? { ...item, qty: value } : item))} keyboardType="decimal-pad" />
            <Field label={t('purchasePrice')} value={line.rate} onChangeText={(value) => setLines((current) => current.map((item) => item.productId === line.productId ? { ...item, rate: value } : item))} keyboardType="decimal-pad" />
          </View>
        );
      })}
      <Choice options={(['cash', 'upi', 'card', 'credit'] as PayMode[]).map((item) => ({ id: item, label: t(item) }))} value={mode} onChange={(id) => setMode(id as PayMode)} />
      {mode === 'credit' ? <Field label={t('paidNow')} value={paid} onChangeText={setPaid} keyboardType="decimal-pad" /> : null}
      <Field label={t('note')} value={note} onChangeText={setNote} />
      <T weight="bold">{t('grandTotal')} {formatMoney(priced.total)}</T>
      <Button label={busy ? t('working') : t('savePurchase')} onPress={save} disabled={busy} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  party: { padding: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  on: { borderColor: colors.green, backgroundColor: colors.greenSoft },
  muted: { color: colors.muted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  line: { gap: 8, padding: 12, borderRadius: 16, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
});

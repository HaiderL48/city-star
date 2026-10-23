import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Switch, View } from 'react-native';

import { Button, Choice, Field, Screen, T } from '@/components/ui';
import { getProduct, saveProduct } from '@/db';
import { useI18n } from '@/i18n';
import { GST_RATES, SUGGESTED_CATEGORIES, UNITS } from '@/lib/catalog';
import { errorKey } from '@/lib/errors';
import { num } from '@/lib/format';
import { categoryLabel } from '@/print/model';
import { useSession } from '@/state/session';
import { colors } from '@/theme';

export default function ProductForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { t } = useI18n();
  const { notify } = useSession();
  const router = useRouter();
  const [name, setName] = useState('');
  const [nameGu, setNameGu] = useState('');
  const [sku, setSku] = useState('');
  const [category, setCategory] = useState('grocery');
  const [unit, setUnit] = useState('pcs');
  const [salePrice, setSalePrice] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [gstRate, setGstRate] = useState(5);
  const [stock, setStock] = useState('');
  const [lowStock, setLowStock] = useState('5');
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    getProduct(id).then((product) => {
      if (!product) return;
      setName(product.name);
      setNameGu(product.nameGu);
      setSku(product.sku);
      setCategory(product.category || 'grocery');
      setUnit(product.unit);
      setSalePrice(String(product.salePrice));
      setPurchasePrice(String(product.purchasePrice));
      setGstRate(product.gstRate);
      setStock(String(product.stock));
      setLowStock(String(product.lowStock));
      setActive(product.active);
    });
  }, [id]);

  const save = async () => {
    setBusy(true);
    try {
      await saveProduct({
        id,
        name,
        nameGu,
        sku,
        category,
        unit,
        salePrice: num(salePrice),
        purchasePrice: num(purchasePrice),
        gstRate,
        stock: num(stock),
        lowStock: num(lowStock),
        active,
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
      <Stack.Screen options={{ title: id ? t('editItem') : t('newItem') }} />
      <T style={styles.muted}>{t('newProductHelp')}</T>
      <Field label={t('name')} value={name} onChangeText={setName} />
      <Field label={t('shopNameGu')} value={nameGu} onChangeText={setNameGu} />
      <Field label={t('barcode')} value={sku} onChangeText={setSku} />
      <T weight="semi" style={styles.label}>{t('category')}</T>
      <Choice
        options={SUGGESTED_CATEGORIES.map((item) => ({ id: item, label: categoryLabel(item, t) }))}
        value={SUGGESTED_CATEGORIES.includes(category as (typeof SUGGESTED_CATEGORIES)[number]) ? category : 'otherCat'}
        onChange={setCategory}
      />
      <Field label={t('categoryName')} value={category} onChangeText={setCategory} />
      <T weight="semi" style={styles.label}>{t('unit')}</T>
      <Choice options={UNITS.map((item) => ({ id: item, label: t(`unit_${item}`) }))} value={unit} onChange={setUnit} />
      <Field label={t('salePrice')} value={salePrice} onChangeText={setSalePrice} keyboardType="decimal-pad" />
      <Field label={t('purchasePrice')} value={purchasePrice} onChangeText={setPurchasePrice} keyboardType="decimal-pad" />
      <T weight="semi" style={styles.label}>{t('gstChips')}</T>
      <Choice options={GST_RATES.map((item) => ({ id: String(item), label: `${item}%` }))} value={String(gstRate)} onChange={(value) => setGstRate(Number(value))} />
      <Field label={t('currentStock')} value={stock} onChangeText={setStock} keyboardType="decimal-pad" />
      <Field label={t('lowAt')} value={lowStock} onChangeText={setLowStock} keyboardType="decimal-pad" />
      <View style={styles.row}>
        <T>{t('activeItem')}</T>
        <Switch value={active} onValueChange={setActive} trackColor={{ true: colors.green }} />
      </View>
      <Button label={busy ? t('working') : t('saveItem')} onPress={save} disabled={busy} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { color: colors.muted },
  label: { color: colors.muted, fontSize: 13 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});

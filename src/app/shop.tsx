import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Switch, View } from 'react-native';

import { Button, Field, Screen, T } from '@/components/ui';
import { saveSettings, wipeAll } from '@/db';
import { useI18n } from '@/i18n';
import { abilities } from '@/lib/access';
import { useSession } from '@/state/session';
import { colors } from '@/theme';

export default function ShopScreen() {
  const { t } = useI18n();
  const { settings, user, reload } = useSession();
  const router = useRouter();
  const can = abilities(user?.role ?? 'cashier');
  const [shopName, setShopName] = useState(settings?.shopName ?? '');
  const [shopNameGu, setShopNameGu] = useState(settings?.shopNameGu ?? '');
  const [phone, setPhone] = useState(settings?.phone ?? '');
  const [address, setAddress] = useState(settings?.address ?? '');
  const [gstin, setGstin] = useState(settings?.gstin ?? '');
  const [prefix, setPrefix] = useState(settings?.invoicePrefix ?? 'CS');
  const [taxInclusive, setTaxInclusive] = useState(settings?.taxInclusive !== false);
  const [confirmName, setConfirmName] = useState('');
  const [busy, setBusy] = useState(false);

  if (!settings) return null;

  const save = async () => {
    if (!can.shopEdit) return;
    setBusy(true);
    try {
      await saveSettings({
        shopName: shopName.trim() || settings.shopName,
        shopNameGu: shopNameGu.trim(),
        phone: phone.trim(),
        address: address.trim(),
        gstin: gstin.trim().toUpperCase(),
        invoicePrefix: prefix.trim() || 'CS',
        taxInclusive,
      });
      await reload();
      Alert.alert(t('shopProfile'), t('shopSaved'));
    } finally {
      setBusy(false);
    }
  };

  const erase = async () => {
    if (confirmName.trim() !== settings.shopName) {
      Alert.alert(t('danger'), t('nameMismatch'));
      return;
    }
    await wipeAll();
    await reload();
    router.replace('/setup');
  };

  return (
    <Screen scroll>
      <Stack.Screen options={{ title: t('shopProfile') }} />
      <Field label={t('shopName')} value={shopName} onChangeText={setShopName} editable={can.shopEdit} />
      <Field label={t('shopNameGu')} value={shopNameGu} onChangeText={setShopNameGu} editable={can.shopEdit} />
      <T style={styles.muted}>{t('bothNames')}</T>
      <Field label={t('shopPhone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" editable={can.shopEdit} />
      <Field label={t('shopAddress')} value={address} onChangeText={setAddress} editable={can.shopEdit} />
      <Field label={t('gstin')} value={gstin} onChangeText={setGstin} autoCapitalize="characters" editable={can.shopEdit} />
      <Field label={t('invoicePrefix')} value={prefix} onChangeText={setPrefix} autoCapitalize="characters" editable={can.shopEdit} />
      <T style={styles.muted}>{t('prefixHelp')}</T>
      <View style={styles.row}>
        <View style={styles.flex}>
          <T weight="semi">{t('pricesInclude')}</T>
          <T style={styles.muted}>{t('taxHelp')}</T>
        </View>
        <Switch value={taxInclusive} onValueChange={setTaxInclusive} disabled={!can.shopEdit} trackColor={{ true: colors.green }} />
      </View>
      {can.shopEdit ? <Button label={busy ? t('working') : t('saveShop')} onPress={save} disabled={busy} /> : <T style={styles.muted}>{t('cashierCan')}</T>}
      {can.wipe ? (
        <View style={styles.danger}>
          <T weight="bold" style={styles.dangerTitle}>{t('danger')}</T>
          <T style={styles.muted}>{t('wipeWarn')}</T>
          <Field label={t('typeShop')} value={confirmName} onChangeText={setConfirmName} />
          <Button label={t('wipe')} kind="danger" onPress={erase} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { color: colors.muted },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1, gap: 4 },
  danger: { marginTop: 12, gap: 8, padding: 12, borderRadius: 16, backgroundColor: colors.redSoft },
  dangerTitle: { color: colors.red },
});

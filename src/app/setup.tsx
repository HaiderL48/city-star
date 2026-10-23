import { useState } from 'react';
import { Alert, StyleSheet, Switch, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PinPad } from '@/components/pin-pad';
import { Button, Field, LanguageSwitch, Screen, T } from '@/components/ui';
import { completeSetup } from '@/db';
import { useI18n } from '@/i18n';
import { errorKey } from '@/lib/errors';
import { useSession } from '@/state/session';
import { colors } from '@/theme';

export default function SetupScreen() {
  const { t, lang } = useI18n();
  const { signIn, reload } = useSession();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [shopName, setShopName] = useState('');
  const [shopNameGu, setShopNameGu] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [gstin, setGstin] = useState('');
  const [owner, setOwner] = useState('');
  const [pin, setPin] = useState('');
  const [sample, setSample] = useState(true);
  const [taxInclusive, setTaxInclusive] = useState(true);
  const [busy, setBusy] = useState(false);

  const finish = async () => {
    setBusy(true);
    try {
      const user = await completeSetup({
        shopName,
        shopNameGu,
        phone,
        address,
        gstin,
        language: lang,
        ownerName: owner,
        pin,
        sample,
        taxInclusive,
      });
      await signIn(user);
      await reload();
      router.replace('/home');
    } catch (error) {
      Alert.alert(t('failedTitle'), t(errorKey(error)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll>
      <View style={{ height: insets.top }} />
      <View style={styles.top}>
        <View style={styles.row}>
          <T weight="bold" style={styles.brand}>
            City Star
          </T>
          <LanguageSwitch />
        </View>
        <T style={styles.tag}>{t('tagline')}</T>
        <T weight="semi" style={styles.step}>
          {t('stepOf', { step: step + 1 })}
        </T>
      </View>

      {step === 0 ? (
        <View style={styles.block}>
          <T weight="bold" style={styles.h}>
            {t('chooseLanguage')}
          </T>
          <T style={styles.help}>{t('changeLater')}</T>
          <Button label={t('continue')} onPress={() => setStep(1)} />
        </View>
      ) : null}

      {step === 1 ? (
        <View style={styles.block}>
          <T weight="bold" style={styles.h}>
            {t('yourShop')}
          </T>
          <Field label={t('shopName')} value={shopName} onChangeText={setShopName} />
          <Field label={t('shopNameGu')} value={shopNameGu} onChangeText={setShopNameGu} />
          <Field label={t('shopPhone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <Field label={t('shopAddress')} value={address} onChangeText={setAddress} />
          <Field label={t('gstinOptional')} value={gstin} onChangeText={setGstin} autoCapitalize="characters" />
          <View style={styles.switchRow}>
            <T style={styles.flex}>{t('pricesInclude')}</T>
            <Switch value={taxInclusive} onValueChange={setTaxInclusive} trackColor={{ true: colors.green }} />
          </View>
          <Button label={t('continue')} onPress={() => (shopName.trim() ? setStep(2) : Alert.alert(t('failedTitle'), t('shopRequired')))} />
          <Button label={t('back')} kind="ghost" onPress={() => setStep(0)} />
        </View>
      ) : null}

      {step === 2 ? (
        <View style={styles.block}>
          <T weight="bold" style={styles.h}>
            {t('almost')}
          </T>
          <Field label={t('yourName')} value={owner} onChangeText={setOwner} />
          <T style={styles.help}>{t('pinHelp')}</T>
          <PinPad value={pin} onChange={setPin} />
          <View style={styles.switchRow}>
            <View style={styles.flex}>
              <T weight="semi">{t('includeSample')}</T>
              <T style={styles.help}>{t('sampleHelp')}</T>
            </View>
            <Switch value={sample} onValueChange={setSample} trackColor={{ true: colors.green }} />
          </View>
          <Button label={busy ? t('working') : t('startShop')} onPress={finish} disabled={busy} />
          <Button label={t('back')} kind="ghost" onPress={() => setStep(1)} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { backgroundColor: colors.green, marginHorizontal: -16, marginTop: -16, padding: 20, paddingBottom: 28, gap: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { color: colors.white, fontSize: 28 },
  tag: { color: '#E7F6EE' },
  step: { color: colors.white },
  block: { gap: 12, marginTop: -12 },
  h: { fontSize: 24 },
  help: { color: colors.muted },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1, gap: 4 },
});

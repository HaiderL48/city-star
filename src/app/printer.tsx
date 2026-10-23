import { Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Button, Choice, Field, Screen, T } from '@/components/ui';
import { saveSettings } from '@/db';
import type { PaperWidth } from '@/db/types';
import { useI18n } from '@/i18n';
import { errorKey } from '@/lib/errors';
import { shopTitle } from '@/lib/format';
import {
  disconnectPrinter,
  isEverycom,
  kickDrawer,
  normalizeAddress,
  printTest,
  scanPrinters,
  type PrinterDevice,
} from '@/print/printer';
import { useSession } from '@/state/session';
import { colors } from '@/theme';

export default function PrinterScreen() {
  const { t, lang } = useI18n();
  const { settings, reload } = useSession();
  const [paired, setPaired] = useState<PrinterDevice[]>([]);
  const [found, setFound] = useState<PrinterDevice[]>([]);
  const [address, setAddress] = useState(settings?.printerAddress ?? '');
  const [paper, setPaper] = useState<PaperWidth>(settings?.paperWidth ?? '58');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  if (!settings) return null;

  const remember = async (device?: PrinterDevice) => {
    const next = device?.address || normalizeAddress({ address, deviceType: 'bt' });
    await saveSettings({
      printerAddress: next,
      printerName: device?.name || next,
      paperWidth: paper,
    });
    setAddress(next);
    await reload();
    Alert.alert(t('printerTitle'), t('printerSaved'));
  };

  const scan = async () => {
    setBusy(true);
    setStatus(t('scanning'));
    try {
      const result = await scanPrinters();
      setPaired(result.paired);
      setFound(result.found);
      setStatus(result.paired.length + result.found.length ? t('ready') : t('noDevice'));
    } catch (error) {
      const message = t(errorKey(error));
      setStatus(message);
      Alert.alert(t('printerTitle'), message);
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setBusy(true);
    try {
      await printTest(settings.printerAddress || normalizeAddress({ address }), paper, shopTitle(settings, lang));
      Alert.alert(t('testPrint'), t('testSent'));
    } catch (error) {
      Alert.alert(t('printFailed'), t(errorKey(error)));
    } finally {
      setBusy(false);
    }
  };

  const devices = [
    ...paired.map((device) => ({ ...device, group: t('paired') })),
    ...found.map((device) => ({ ...device, group: t('found') })),
  ];

  return (
    <Screen scroll>
      <Stack.Screen options={{ title: t('printerTitle') }} />
      <T style={styles.muted}>{t('printerHelp')}</T>
      <T style={styles.muted}>{t('helpPair')}</T>
      <T style={styles.muted}>{t('gujaratiPrint')}</T>
      <T weight="semi">
        {t('savedPrinter')}: {settings.printerName || t('notSet')}
      </T>
      <T style={styles.muted}>{settings.printerAddress}</T>
      {Platform.OS === 'web' ? <T style={styles.warn}>{t('webOnly')}</T> : <T style={styles.muted}>{t('needsBuild')}</T>}
      <T style={styles.muted}>{t('command')}</T>
      <Choice
        options={[
          { id: '58', label: t('paper58') },
          { id: '80', label: t('paper80') },
        ]}
        value={paper}
        onChange={(id) => setPaper(id as PaperWidth)}
      />
      <T style={styles.muted}>{t('widthHelp')}</T>
      <Button label={busy ? t('scanning') : t('scan')} onPress={scan} disabled={busy} icon="bluetooth" />
      {status ? <T>{status}</T> : null}
      {devices.map((device) => (
        <Pressable key={device.address} onPress={() => remember(device)} style={styles.device}>
          <View style={styles.flex}>
            <T weight="semi">
              {device.name} {isEverycom(device.name) ? `· ${t('everycom')}` : ''}
            </T>
            <T style={styles.muted}>
              {device.group} · {device.deviceType === 'ble' ? t('ble') : t('classic')} · {device.address}
            </T>
          </View>
          <T weight="semi" style={styles.link}>
            {t('usePrinter')}
          </T>
        </Pressable>
      ))}
      <Field label={t('manualAddress')} value={address} onChangeText={setAddress} autoCapitalize="characters" placeholder={t('addressHint')} />
      <Button label={t('useTyped')} kind="secondary" onPress={() => remember().catch((error) => Alert.alert(t('failedTitle'), t(errorKey(error))))} />
      <Button label={t('testPrint')} kind="secondary" onPress={test} disabled={busy} />
      <Button
        label={t('kickDrawer')}
        kind="ghost"
        onPress={() => {
          kickDrawer(settings.printerAddress)
            .then(() => Alert.alert(t('kickDrawer'), t('yesPrint')))
            .catch((error) => Alert.alert(t('printFailed'), t(errorKey(error))));
        }}
      />
      <Button
        label={t('clearPrinter')}
        kind="ghost"
        onPress={async () => {
          await disconnectPrinter(settings.printerAddress);
          await saveSettings({ printerAddress: '', printerName: '' });
          setAddress('');
          await reload();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { color: colors.muted },
  warn: { color: colors.gold },
  device: { padding: 12, borderRadius: 14, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, gap: 6 },
  flex: { gap: 2 },
  link: { color: colors.greenDark },
});

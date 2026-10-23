import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet } from 'react-native';

import { Button, Choice, Field, Screen, T } from '@/components/ui';
import { getParty, saveParty } from '@/db';
import type { PartyKind } from '@/db/types';
import { useI18n } from '@/i18n';
import { errorKey } from '@/lib/errors';
import { num } from '@/lib/format';
import { useSession } from '@/state/session';
import { colors } from '@/theme';

export default function PartyForm() {
  const params = useLocalSearchParams<{ id?: string; kind?: string }>();
  const { t } = useI18n();
  const { notify } = useSession();
  const router = useRouter();
  const [kind, setKind] = useState<PartyKind>(params.kind === 'supplier' ? 'supplier' : 'customer');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [gstin, setGstin] = useState('');
  const [opening, setOpening] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!params.id) return;
    getParty(params.id).then((party) => {
      if (!party) return;
      setKind(party.kind);
      setName(party.name);
      setPhone(party.phone);
      setAddress(party.address);
      setGstin(party.gstin);
    });
  }, [params.id]);

  const save = async () => {
    setBusy(true);
    try {
      await saveParty({
        id: params.id,
        kind,
        name,
        phone,
        address,
        gstin,
        opening: params.id ? undefined : num(opening),
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
      <Stack.Screen options={{ title: params.id ? t('editParty') : t('newParty') }} />
      <Choice
        options={[{ id: 'customer', label: t('customer') }, { id: 'supplier', label: t('supplier') }]}
        value={kind}
        onChange={(id) => setKind(id as PartyKind)}
      />
      <Field label={t('name')} value={name} onChangeText={setName} />
      <Field label={t('phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <Field label={t('address')} value={address} onChangeText={setAddress} />
      <Field label={t('gstinOptional')} value={gstin} onChangeText={setGstin} autoCapitalize="characters" />
      {!params.id ? (
        <>
          <Field label={t('openingBalance')} value={opening} onChangeText={setOpening} keyboardType="decimal-pad" />
          <T style={styles.muted}>{t('openingHelp')}</T>
        </>
      ) : null}
      <Button label={busy ? t('working') : t('saveParty')} onPress={save} disabled={busy} />
    </Screen>
  );
}

const styles = StyleSheet.create({ muted: { color: colors.muted } });

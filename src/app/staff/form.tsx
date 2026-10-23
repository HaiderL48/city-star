import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Switch, View } from 'react-native';

import { Button, Choice, Field, Screen, T } from '@/components/ui';
import { getUser, saveUser } from '@/db';
import type { Role } from '@/db/types';
import { useI18n } from '@/i18n';
import { errorKey } from '@/lib/errors';
import { useSession } from '@/state/session';
import { colors } from '@/theme';

const ROLES: Role[] = ['admin', 'manager', 'cashier'];

export default function StaffForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { t } = useI18n();
  const { notify } = useSession();
  const router = useRouter();
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('cashier');
  const [pin, setPin] = useState('');
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    getUser(id).then((member) => {
      if (!member) return;
      setName(member.name);
      setRole(member.role);
      setActive(member.active);
    });
  }, [id]);

  const save = async () => {
    setBusy(true);
    try {
      await saveUser({ id, name, role, pin, active });
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
      <Stack.Screen options={{ title: id ? t('editStaff') : t('newStaff') }} />
      <Field label={t('staffName')} value={name} onChangeText={setName} />
      <T weight="semi" style={styles.label}>{t('role')}</T>
      <Choice options={ROLES.map((item) => ({ id: item, label: t(item) }))} value={role} onChange={(value) => setRole(value as Role)} />
      <T style={styles.muted}>{role === 'admin' ? t('roleHelp') : role === 'manager' ? t('managerCan') : t('cashierCan')}</T>
      <Field label={id ? t('pinKeep') : t('newPin')} value={pin} onChangeText={setPin} keyboardType="number-pad" secureTextEntry />
      <View style={styles.row}>
        <T>{t('active')}</T>
        <Switch value={active} onValueChange={setActive} trackColor={{ true: colors.green }} />
      </View>
      <Button label={busy ? t('working') : t('save')} onPress={save} disabled={busy} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.muted, fontSize: 13 },
  muted: { color: colors.muted },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});

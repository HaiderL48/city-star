import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, Screen, T } from '@/components/ui';
import { listUsers } from '@/db';
import type { User } from '@/db/types';
import { useI18n } from '@/i18n';
import { useSession } from '@/state/session';
import { colors } from '@/theme';

export default function StaffScreen() {
  const { t } = useI18n();
  const { user, version } = useSession();
  const router = useRouter();
  const [staff, setStaff] = useState<User[]>([]);

  useFocusEffect(useCallback(() => { listUsers().then(setStaff).catch(() => undefined); }, [version]));

  return (
    <Screen scroll={false}>
      <Stack.Screen options={{ title: t('staffAccess') }} />
      <View style={styles.list}>
        <T style={styles.muted}>{t('roleHelp')}</T>
        {staff.map((member) => (
          <Pressable key={member.id} onPress={() => router.push({ pathname: '/staff/form', params: { id: member.id } })} style={styles.row}>
            <View style={styles.flex}>
              <T weight="semi">
                {member.name} {member.id === user?.id ? `· ${t('you')}` : ''}
              </T>
              <T style={styles.muted}>{t(member.role)} · {member.active ? t('active') : t('inactiveStaff')}</T>
            </View>
          </Pressable>
        ))}
        <T style={styles.muted}>{t('managerCan')}</T>
        <T style={styles.muted}>{t('cashierCan')}</T>
      </View>
      <Button label={t('addStaff')} onPress={() => router.push('/staff/form')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, gap: 8 },
  row: { padding: 12, borderRadius: 14, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  flex: { gap: 2 },
  muted: { color: colors.muted },
});

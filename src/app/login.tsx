import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PinPad } from '@/components/pin-pad';
import { Button, LanguageSwitch, Screen, T } from '@/components/ui';
import { listUsers, verifyPin } from '@/db';
import type { User } from '@/db/types';
import { useI18n } from '@/i18n';
import { shopTitle } from '@/lib/format';
import { useSession } from '@/state/session';
import { colors } from '@/theme';

export default function LoginScreen() {
  const { settings, signIn } = useSession();
  const { t, lang } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [staff, setStaff] = useState<User[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listUsers().then((users) => {
      const active = users.filter((user) => user.active);
      setStaff(active);
      setSelected(active[0]?.id ?? '');
    });
  }, []);

  const submit = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      const ok = await verifyPin(selected, pin);
      if (!ok) {
        setPin('');
        Alert.alert(t('failedTitle'), t('wrongPin'));
        return;
      }
      const user = staff.find((item) => item.id === selected);
      if (!user) return;
      await signIn(user);
      router.replace('/home');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll>
      <View style={{ height: insets.top }} />
      <View style={styles.hero}>
        <View style={styles.row}>
          <T weight="bold" style={styles.brand}>
            {settings ? shopTitle(settings, lang) : 'City Star'}
          </T>
          <LanguageSwitch />
        </View>
        <T style={styles.tag}>{t('goodCounter')}</T>
      </View>
      <View style={styles.sheet}>
        <T weight="bold" style={styles.h}>
          {t('selectStaff')}
        </T>
        <View style={styles.people}>
          {staff.map((user) => {
            const on = user.id === selected;
            return (
              <Pressable key={user.id} onPress={() => { setSelected(user.id); setPin(''); }} style={[styles.person, on && styles.personOn]}>
                <T weight="semi" style={{ color: on ? colors.greenDark : colors.ink }}>
                  {user.name}
                </T>
                <T style={styles.role}>{t(user.role)}</T>
              </Pressable>
            );
          })}
        </View>
        <T weight="semi">{t('enterPin')}</T>
        <PinPad value={pin} onChange={setPin} />
        <Button label={busy ? t('working') : t('signIn')} onPress={submit} disabled={busy || pin.length < 4 || !selected} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.green, marginHorizontal: -16, marginTop: -16, padding: 20, paddingBottom: 36, gap: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  brand: { color: colors.white, fontSize: 26, flex: 1 },
  tag: { color: '#E7F6EE' },
  sheet: { marginTop: -16, gap: 12 },
  h: { fontSize: 20 },
  people: { gap: 8 },
  person: { padding: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  personOn: { borderColor: colors.green, backgroundColor: colors.greenSoft },
  role: { color: colors.muted, fontSize: 13 },
});

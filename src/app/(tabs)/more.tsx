import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LanguageSwitch, MenuRow, T } from '@/components/ui';
import { useI18n } from '@/i18n';
import { abilities } from '@/lib/access';
import { shopTitle } from '@/lib/format';
import { useSession } from '@/state/session';
import { colors } from '@/theme';

export default function MoreScreen() {
  const { t, lang } = useI18n();
  const { settings, user } = useSession();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const can = abilities(user?.role ?? 'cashier');
  if (!settings || !user) return null;

  return (
    <ScrollView contentContainerStyle={[styles.list, { paddingTop: insets.top + 16 }]}>
      <View style={styles.hero}>
        <View style={styles.row}>
          <View style={styles.flex}>
            <T weight="bold" style={styles.shop}>
              {shopTitle(settings, lang)}
            </T>
            <T style={styles.soft}>
              {user.name} · {t(user.role)}
            </T>
          </View>
          <LanguageSwitch />
        </View>
      </View>
      <MenuRow icon="storefront-outline" title={t('shopProfile')} detail={settings.phone || t('notSet')} onPress={() => router.push('/shop')} />
      <MenuRow icon="print-outline" title={t('printerTitle')} detail={settings.printerName || t('notSet')} onPress={() => router.push('/printer')} />
      {can.staff ? <MenuRow icon="people-outline" title={t('staffAccess')} onPress={() => router.push('/staff')} /> : null}
      <View style={styles.about}>
        <T weight="semi">{t('about')}</T>
        <T style={styles.muted}>{t('aboutBody')}</T>
        <T style={styles.muted}>{t('languagesAbout')}</T>
        <T style={styles.muted}>{t('whatsappAbout')}</T>
        <T style={styles.muted}>{t('printerAbout')}</T>
        <T style={styles.muted}>
          {t('version')} {Constants.expoConfig?.version ?? '1.0.0'}
        </T>
      </View>
      <Pressable onPress={() => Alert.alert(t('printerTitle'), `${t('deviceBuild')}\n${t('command')}`)}>
        <T style={styles.link}>{t('expoGoOk')}</T>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 10, paddingBottom: 28 },
  hero: { backgroundColor: colors.green, borderRadius: 18, padding: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
  shop: { color: colors.white, fontSize: 22 },
  soft: { color: '#E7F6EE' },
  about: { gap: 6, padding: 4 },
  muted: { color: colors.muted },
  link: { color: colors.greenDark },
});

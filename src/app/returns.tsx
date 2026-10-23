import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { Button, T } from '@/components/ui';
import { listReturns } from '@/db';
import type { SaleReturn } from '@/db/types';
import { useI18n } from '@/i18n';
import { formatDate, formatMoney } from '@/lib/format';
import { useSession } from '@/state/session';
import { colors } from '@/theme';

export default function ReturnsScreen() {
  const { t, lang } = useI18n();
  const { version } = useSession();
  const router = useRouter();
  const [rows, setRows] = useState<SaleReturn[]>([]);
  useFocusEffect(useCallback(() => { listReturns().then(setRows).catch(() => undefined); }, [version]));

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: t('returns') }} />
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<T style={styles.empty}>{t('noReturns')}</T>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.flex}>
              <T weight="semi">{item.number}</T>
              <T style={styles.muted}>{item.invoiceNumber} · {item.partyName || t('walkIn')} · {formatDate(item.date, lang)}</T>
            </View>
            <T weight="bold">{formatMoney(item.total)}</T>
          </View>
        )}
      />
      <View style={styles.footer}><Button label={t('newReturn')} onPress={() => router.push('/return/new')} /></View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  list: { padding: 12, gap: 8 },
  row: { flexDirection: 'row', backgroundColor: colors.white, borderRadius: 16, borderWidth: 1, borderColor: colors.line, padding: 12 },
  flex: { flex: 1 },
  muted: { color: colors.muted, fontSize: 13 },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 24 },
  footer: { padding: 12 },
});

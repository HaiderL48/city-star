import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { Button, T } from '@/components/ui';
import { listPurchases } from '@/db';
import type { Purchase } from '@/db/types';
import { useI18n } from '@/i18n';
import { formatDate, formatMoney } from '@/lib/format';
import { modeLabel } from '@/components/ui';
import { useSession } from '@/state/session';
import { colors } from '@/theme';

export default function PurchasesScreen() {
  const { t, lang } = useI18n();
  const { version } = useSession();
  const router = useRouter();
  const [rows, setRows] = useState<Purchase[]>([]);

  useFocusEffect(useCallback(() => { listPurchases().then(setRows).catch(() => undefined); }, [version]));

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: t('purchases') }} />
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<T style={styles.empty}>{t('noPurchases')}</T>}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push({ pathname: '/purchase/[id]', params: { id: item.id } })} style={styles.row}>
            <View style={styles.flex}>
              <T weight="semi">{item.number}</T>
              <T style={styles.muted}>{item.partyName || t('none')} · {formatDate(item.date, lang)} · {modeLabel(item.paymentMode, t)}</T>
            </View>
            <View style={styles.end}>
              <T weight="bold">{formatMoney(item.total)}</T>
              {item.due > 0 ? <T style={styles.due}>{t('dueLeft', { amount: formatMoney(item.due) })}</T> : null}
            </View>
          </Pressable>
        )}
      />
      <View style={styles.footer}><Button label={t('newPurchase')} onPress={() => router.push('/purchase/form')} /></View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  list: { padding: 12, gap: 8 },
  row: { flexDirection: 'row', backgroundColor: colors.white, borderRadius: 16, borderWidth: 1, borderColor: colors.line, padding: 12, gap: 8 },
  flex: { flex: 1 },
  end: { alignItems: 'flex-end' },
  muted: { color: colors.muted, fontSize: 13 },
  due: { color: colors.gold, fontSize: 12 },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 24 },
  footer: { padding: 12 },
});

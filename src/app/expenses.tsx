import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { Button, T } from '@/components/ui';
import { listExpenses } from '@/db';
import type { Expense } from '@/db/types';
import { useI18n } from '@/i18n';
import { expenseLabel } from '@/print/model';
import { formatDate, formatMoney } from '@/lib/format';
import { modeLabel } from '@/components/ui';
import { useSession } from '@/state/session';
import { colors } from '@/theme';

export default function ExpensesScreen() {
  const { t, lang } = useI18n();
  const { version } = useSession();
  const router = useRouter();
  const [rows, setRows] = useState<Expense[]>([]);
  useFocusEffect(useCallback(() => { listExpenses().then(setRows).catch(() => undefined); }, [version]));

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: t('expenses') }} />
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<T style={styles.empty}>{t('noExpenses')}</T>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.flex}>
              <T weight="semi">{expenseLabel(item.category, t)}</T>
              <T style={styles.muted}>{formatDate(item.date, lang)} · {modeLabel(item.paymentMode, t)}</T>
              {item.note ? <T style={styles.muted}>{item.note}</T> : null}
            </View>
            <T weight="bold">{formatMoney(item.amount)}</T>
          </View>
        )}
      />
      <View style={styles.footer}><Button label={t('newExpense')} onPress={() => router.push('/expense/form')} /></View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  list: { padding: 12, gap: 8 },
  row: { flexDirection: 'row', backgroundColor: colors.white, borderRadius: 16, borderWidth: 1, borderColor: colors.line, padding: 12, gap: 8 },
  flex: { flex: 1 },
  muted: { color: colors.muted, fontSize: 13 },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 24 },
  footer: { padding: 12 },
});

import { Stack, useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Button, Pill, T } from '@/components/ui';
import { listInvoices } from '@/db';
import type { Invoice } from '@/db/types';
import { useI18n } from '@/i18n';
import { formatDate, formatMoney } from '@/lib/format';
import { useSession } from '@/state/session';
import { colors, fonts } from '@/theme';

export default function InvoicesScreen() {
  const { t, lang } = useI18n();
  const { version } = useSession();
  const router = useRouter();
  const [rows, setRows] = useState<Invoice[]>([]);
  const [query, setQuery] = useState('');
  const [dueOnly, setDueOnly] = useState(false);

  const load = useCallback(() => {
    listInvoices(query, dueOnly).then(setRows).catch(() => undefined);
  }, [query, dueOnly]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load, version]),
  );

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: t('invoices') }} />
      <TextInput value={query} onChangeText={setQuery} placeholder={t('searchBills')} placeholderTextColor="#8A978F" style={styles.search} />
      <Pressable onPress={() => setDueOnly((value) => !value)} style={styles.filter}>
        <T weight="semi" style={styles.link}>{dueOnly ? t('all') : t('onlyDue')}</T>
      </Pressable>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<T style={styles.empty}>{t('noBills')}</T>}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push({ pathname: '/invoice/[id]', params: { id: item.id } })} style={styles.row}>
            <View style={styles.flex}>
              <T weight="semi">{item.number}</T>
              <T style={styles.muted}>{item.partyName || t('walkIn')} · {formatDate(item.date, lang)}</T>
            </View>
            <View style={styles.end}>
              <T weight="bold">{formatMoney(item.total)}</T>
              <Pill status={item.status} />
            </View>
          </Pressable>
        )}
      />
      <View style={styles.footer}>
        <Button label={t('firstBill')} onPress={() => router.push('/sale')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  search: { margin: 12, marginBottom: 0, height: 46, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, paddingHorizontal: 12, fontFamily: fonts.regular, color: colors.ink },
  filter: { paddingHorizontal: 16, paddingTop: 8 },
  link: { color: colors.greenDark },
  list: { padding: 12, gap: 8 },
  row: { flexDirection: 'row', gap: 8, backgroundColor: colors.white, borderRadius: 16, borderWidth: 1, borderColor: colors.line, padding: 12 },
  flex: { flex: 1 },
  end: { alignItems: 'flex-end', gap: 4 },
  muted: { color: colors.muted, fontSize: 13 },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 20 },
  footer: { padding: 12 },
});

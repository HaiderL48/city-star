import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Button, T } from '@/components/ui';
import { listParties } from '@/db';
import type { Party, PartyKind } from '@/db/types';
import { useI18n } from '@/i18n';
import { formatMoney } from '@/lib/format';
import { useSession } from '@/state/session';
import { colors, fonts } from '@/theme';

export default function PartiesScreen() {
  const { t } = useI18n();
  const { version } = useSession();
  const router = useRouter();
  const [kind, setKind] = useState<PartyKind | 'all'>('all');
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<Party[]>([]);

  useFocusEffect(useCallback(() => {
    listParties(kind === 'all' ? undefined : kind).then(setRows).catch(() => undefined);
  }, [kind, version]));

  const shown = rows.filter((party) => party.name.toLowerCase().includes(query.trim().toLowerCase()) || party.phone.includes(query.trim()));

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: t('parties') }} />
      <TextInput value={query} onChangeText={setQuery} placeholder={t('searchParty')} placeholderTextColor="#8A978F" style={styles.search} />
      <View style={styles.filters}>
        {(['all', 'customer', 'supplier'] as const).map((item) => (
          <Pressable key={item} onPress={() => setKind(item)} style={[styles.chip, kind === item && styles.on]}>
            <T weight="semi" style={{ color: kind === item ? colors.greenDark : colors.muted }}>{item === 'all' ? t('all') : t(item === 'customer' ? 'customers' : 'suppliers')}</T>
          </Pressable>
        ))}
      </View>
      <FlatList
        data={shown}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<T style={styles.empty}>{t('noParties')}</T>}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push({ pathname: '/party/[id]', params: { id: item.id } })} style={styles.row}>
            <View style={styles.flex}>
              <T weight="semi">{item.name}</T>
              <T style={styles.muted}>{item.phone || t(item.kind === 'customer' ? 'customer' : 'supplier')}</T>
            </View>
            <View style={styles.end}>
              <T weight="bold">{formatMoney(Math.abs(item.balance))}</T>
              <T style={styles.muted}>{item.balance < -0.001 ? t('advance') : item.kind === 'customer' ? t('theyOwe') : t('youOwe')}</T>
            </View>
          </Pressable>
        )}
      />
      <View style={styles.footer}>
        <Button label={t('newCustomer')} onPress={() => router.push({ pathname: '/party/form', params: { kind: 'customer' } })} />
        <Button label={t('newSupplier')} kind="secondary" onPress={() => router.push({ pathname: '/party/form', params: { kind: 'supplier' } })} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  search: { margin: 12, marginBottom: 0, height: 46, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, paddingHorizontal: 12, fontFamily: fonts.regular, color: colors.ink },
  filters: { flexDirection: 'row', gap: 8, padding: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  on: { backgroundColor: colors.greenSoft, borderColor: colors.green },
  list: { paddingHorizontal: 12, gap: 8 },
  row: { flexDirection: 'row', backgroundColor: colors.white, borderRadius: 16, borderWidth: 1, borderColor: colors.line, padding: 12 },
  flex: { flex: 1 },
  end: { alignItems: 'flex-end' },
  muted: { color: colors.muted, fontSize: 12 },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 20 },
  footer: { padding: 12, gap: 8 },
});

import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Button, T } from '@/components/ui';
import { listProducts } from '@/db';
import type { Product } from '@/db/types';
import { useI18n } from '@/i18n';
import { abilities } from '@/lib/access';
import { categoryLabel } from '@/print/model';
import { formatMoney, formatQty, localizedName } from '@/lib/format';
import { useSession } from '@/state/session';
import { colors, fonts } from '@/theme';

export default function StockScreen() {
  const { t, lang } = useI18n();
  const { user, version } = useSession();
  const router = useRouter();
  const canEdit = abilities(user?.role ?? 'cashier').editStock;
  const showCost = abilities(user?.role ?? 'cashier').purchasePrice;
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState('');
  const [hidden, setHidden] = useState(false);

  useFocusEffect(
    useCallback(() => {
      listProducts(true).then(setProducts).catch(() => undefined);
    }, [version]),
  );

  const shown = products.filter((product) => {
    if (!hidden && !product.active) return false;
    const q = query.trim().toLowerCase();
    return !q || `${product.name} ${product.nameGu} ${product.sku}`.toLowerCase().includes(q);
  });

  return (
    <View style={styles.screen}>
      <TextInput value={query} onChangeText={setQuery} placeholder={t('searchItems')} placeholderTextColor="#8A978F" style={styles.search} />
      <FlatList
        data={shown}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<T style={styles.empty}>{t('noItems')}</T>}
        renderItem={({ item }) => (
          <Pressable
            disabled={!canEdit}
            onPress={() => router.push({ pathname: '/product/form', params: { id: item.id } })}
            style={styles.row}>
            <View style={styles.flex}>
              <T weight="semi">{localizedName(item, lang)}</T>
              <T style={styles.muted}>
                {categoryLabel(item.category, t)} · {formatQty(item.stock)} {item.unit}
              </T>
            </View>
            <View style={styles.end}>
              <T weight="bold">{formatMoney(item.salePrice)}</T>
              {showCost ? <T style={styles.muted}>{formatMoney(item.purchasePrice)}</T> : null}
              {item.stock <= item.lowStock ? <T style={styles.low}>{t('lowBadge')}</T> : null}
              {!item.active ? <T style={styles.muted}>{t('hiddenBadge')}</T> : null}
            </View>
          </Pressable>
        )}
      />
      <View style={styles.footer}>
        {canEdit ? <Button label={t('addItem')} onPress={() => router.push('/product/form')} /> : <T style={styles.muted}>{t('cashierStock')}</T>}
        <Pressable onPress={() => setHidden((value) => !value)}>
          <T weight="semi" style={styles.link}>
            {hidden ? t('hide') : t('showInactive')}
          </T>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  search: { margin: 12, marginBottom: 0, height: 46, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, paddingHorizontal: 12, fontFamily: fonts.regular, fontSize: 16, color: colors.ink },
  list: { padding: 12, gap: 8 },
  row: { flexDirection: 'row', gap: 8, backgroundColor: colors.white, borderRadius: 16, borderWidth: 1, borderColor: colors.line, padding: 12 },
  flex: { flex: 1, gap: 3 },
  end: { alignItems: 'flex-end', gap: 2 },
  muted: { color: colors.muted, fontSize: 13 },
  low: { color: colors.gold, fontSize: 12 },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 24 },
  footer: { padding: 12, gap: 8 },
  link: { color: colors.greenDark, textAlign: 'center' },
});

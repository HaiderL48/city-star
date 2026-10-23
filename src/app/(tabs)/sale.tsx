import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { T } from '@/components/ui';
import { listProducts } from '@/db';
import type { Product } from '@/db/types';
import { useI18n } from '@/i18n';
import { categoryLabel } from '@/print/model';
import { formatMoney, formatQty, localizedName } from '@/lib/format';
import { computeBill } from '@/lib/pricing';
import { useCart } from '@/state/cart';
import { useSession } from '@/state/session';
import { colors, fonts } from '@/theme';

export default function SaleScreen() {
  const { t, lang } = useI18n();
  const { settings, version } = useSession();
  const cart = useCart();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');

  useFocusEffect(
    useCallback(() => {
      listProducts().then(setProducts).catch(() => undefined);
    }, [version]),
  );

  const categories = useMemo(() => ['all', ...Array.from(new Set(products.map((product) => product.category).filter(Boolean)))], [products]);
  const shown = products.filter((product) => {
    const q = query.trim().toLowerCase();
    const name = `${product.name} ${product.nameGu} ${product.sku}`.toLowerCase();
    const matchesQuery = !q || name.includes(q);
    const matchesCategory = category === 'all' || product.category === category;
    return matchesQuery && matchesCategory;
  });
  const bill = computeBill(cart.lines, cart.discount, settings?.taxInclusive !== false);

  const add = (product: Product) => {
    cart.addProduct(product);
    Haptics.selectionAsync().catch(() => undefined);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={colors.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('searchItems')}
          placeholderTextColor="#8A978F"
          style={styles.search}
        />
      </View>
      <FlatList
        data={shown}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.chips}>
            {categories.map((item) => {
              const on = item === category;
              return (
                <Pressable key={item} onPress={() => setCategory(item)} style={[styles.chip, on && styles.chipOn]}>
                  <T weight="semi" style={{ color: on ? colors.greenDark : colors.muted, fontSize: 13 }}>
                    {item === 'all' ? t('all') : categoryLabel(item, t)}
                  </T>
                </Pressable>
              );
            })}
          </View>
        }
        ListEmptyComponent={<T style={styles.empty}>{products.length ? t('noMatch') : t('noItems')}</T>}
        renderItem={({ item }) => {
          const qty = cart.lines.find((line) => line.productId === item.id)?.qty ?? 0;
          const low = item.stock <= item.lowStock;
          return (
            <Pressable onPress={() => add(item)} style={styles.row}>
              <View style={styles.flex}>
                <T weight="semi">{localizedName(item, lang)}</T>
                <T style={{ color: low ? colors.red : colors.muted, fontSize: 13 }}>
                  {t('stockLeft', { count: formatQty(item.stock) })} {item.unit}
                </T>
              </View>
              <T weight="bold">{formatMoney(item.salePrice)}</T>
              <View style={[styles.plus, qty > 0 && styles.plusOn]}>
                <T weight="bold" style={{ color: qty > 0 ? colors.white : colors.greenDark }}>
                  {qty > 0 ? formatQty(qty) : '+'}
                </T>
              </View>
            </Pressable>
          );
        }}
      />
      {cart.lines.length > 0 ? (
        <Pressable onPress={() => router.push('/checkout')} style={styles.bar}>
          <View>
            <T weight="semi" style={styles.barText}>
              {t('itemsCount', { count: cart.lines.length })}
            </T>
            <T weight="bold" style={styles.barTotal}>
              {formatMoney(bill.total)}
            </T>
          </View>
          <T weight="bold" style={styles.barText}>
            {t('charge')}
          </T>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  searchBox: {
    margin: 12,
    marginBottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 12,
  },
  search: { flex: 1, height: 46, fontFamily: fonts.regular, fontSize: 16, color: colors.ink },
  list: { padding: 12, gap: 8, paddingBottom: 24 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  chipOn: { backgroundColor: colors.greenSoft, borderColor: colors.green },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.white, borderRadius: 16, borderWidth: 1, borderColor: colors.line, padding: 12 },
  flex: { flex: 1, gap: 2 },
  plus: { minWidth: 36, height: 36, borderRadius: 12, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  plusOn: { backgroundColor: colors.green },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 24 },
  bar: { margin: 12, borderRadius: 16, backgroundColor: colors.green, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  barText: { color: colors.white },
  barTotal: { color: colors.white, fontSize: 20 },
});

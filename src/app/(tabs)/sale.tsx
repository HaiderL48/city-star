import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { T } from '@/components/ui';
import { listProducts } from '@/db';
import type { Product } from '@/db/types';
import { useI18n } from '@/i18n';
import { formatMoney, formatQty, localizedName } from '@/lib/format';
import { computeBill } from '@/lib/pricing';
import { categoryLabel } from '@/print/model';
import { useCart } from '@/state/cart';
import { useSession } from '@/state/session';
import { colors, fonts } from '@/theme';

export default function SaleScreen() {
  const { t, lang } = useI18n();
  const { settings, version } = useSession();
  const cart = useCart();
  const router = useRouter();
  const navigation = useNavigation();
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');

  useLayoutEffect(() => {
    navigation.setOptions({
      title: t('posSale'),
      headerRight: () => (
        <Pressable onPress={() => router.push('/quick-sale')} style={styles.headerBtn} hitSlop={8}>
          <Ionicons name="flash-outline" size={18} color={colors.white} />
          <T weight="semi" style={styles.headerBtnText}>
            {t('quickSale')}
          </T>
        </Pressable>
      ),
    });
  }, [navigation, router, t]);

  useFocusEffect(
    useCallback(() => {
      listProducts().then(setProducts).catch(() => undefined);
    }, [version]),
  );

  const categories = useMemo(
    () => ['all', ...Array.from(new Set(products.map((product) => product.category).filter(Boolean)))],
    [products],
  );
  const shown = products.filter((product) => {
    const q = query.trim().toLowerCase();
    const name = `${product.name} ${product.nameGu} ${product.sku}`.toLowerCase();
    const matchesQuery = !q || name.includes(q);
    const matchesCategory = category === 'all' || product.category === category;
    return matchesQuery && matchesCategory && product.active;
  });
  const bill = computeBill(cart.lines, cart.discount, settings?.taxInclusive !== false);

  const add = (product: Product) => {
    cart.addProduct(product);
    Haptics.selectionAsync().catch(() => undefined);
  };

  const bump = (product: Product, delta: number) => {
    const line = cart.lines.find((item) => item.productId === product.id);
    if (!line) {
      if (delta > 0) add(product);
      return;
    }
    cart.update(line.key, { qty: line.qty + delta });
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
        {cart.lines.length > 0 ? (
          <Pressable
            onPress={() => {
              Alert.alert(t('clearCart'), undefined, [
                { text: t('cancel'), style: 'cancel' },
                { text: t('clear'), style: 'destructive', onPress: () => cart.clear() },
              ]);
            }}
            hitSlop={8}>
            <Ionicons name="trash-outline" size={18} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>

      <T style={styles.hint}>{t('posSaleHelp')}</T>

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
          const line = cart.lines.find((entry) => entry.productId === item.id);
          const qty = line?.qty ?? 0;
          const low = item.stock <= item.lowStock;
          return (
            <View style={[styles.row, qty > 0 && styles.rowOn]}>
              <Pressable onPress={() => add(item)} style={styles.flex}>
                <T weight="semi">{localizedName(item, lang)}</T>
                <T style={{ color: low ? colors.red : colors.muted, fontSize: 13 }}>
                  {t('stockLeft', { count: formatQty(item.stock) })} {item.unit}
                </T>
              </Pressable>
              <T weight="bold">{formatMoney(item.salePrice)}</T>
              {qty > 0 ? (
                <View style={styles.stepper}>
                  <Pressable onPress={() => bump(item, -1)} style={styles.stepBtn}>
                    <T weight="bold" style={styles.stepText}>
                      −
                    </T>
                  </Pressable>
                  <T weight="bold" style={styles.qty}>
                    {formatQty(qty)}
                  </T>
                  <Pressable onPress={() => bump(item, 1)} style={[styles.stepBtn, styles.stepBtnOn]}>
                    <T weight="bold" style={styles.stepTextOn}>
                      +
                    </T>
                  </Pressable>
                </View>
              ) : (
                <Pressable onPress={() => add(item)} style={styles.plus}>
                  <T weight="bold" style={{ color: colors.greenDark }}>
                    +
                  </T>
                </Pressable>
              )}
            </View>
          );
        }}
      />

      {cart.lines.length > 0 ? (
        <Pressable onPress={() => router.push('/checkout')} style={styles.bar}>
          <View>
            <T weight="semi" style={styles.barText}>
              {t('cartTitle')} · {t('itemsCount', { count: cart.lines.length })}
            </T>
            <T weight="bold" style={styles.barTotal}>
              {formatMoney(bill.total)}
            </T>
          </View>
          <View style={styles.checkout}>
            <T weight="bold" style={styles.barText}>
              {t('checkout')}
            </T>
            <Ionicons name="arrow-forward" size={18} color={colors.white} />
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  headerBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 4 },
  headerBtnText: { color: colors.white, fontSize: 13 },
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
  hint: { marginHorizontal: 16, marginTop: 8, color: colors.muted, fontSize: 13 },
  list: { padding: 12, gap: 8, paddingBottom: 24 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  chipOn: { backgroundColor: colors.greenSoft, borderColor: colors.green },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 12,
  },
  rowOn: { borderColor: colors.green, backgroundColor: '#F3FBF6' },
  flex: { flex: 1, gap: 2 },
  plus: {
    minWidth: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.greenSoft,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.greenSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnOn: { backgroundColor: colors.green },
  stepText: { color: colors.greenDark, fontSize: 18, lineHeight: 20 },
  stepTextOn: { color: colors.white, fontSize: 18, lineHeight: 20 },
  qty: { minWidth: 28, textAlign: 'center' },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 24 },
  bar: {
    margin: 12,
    borderRadius: 16,
    backgroundColor: colors.green,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  barText: { color: colors.white },
  barTotal: { color: colors.white, fontSize: 20 },
  checkout: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});

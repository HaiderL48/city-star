import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LanguageSwitch, Pill, T } from '@/components/ui';
import { dashboard } from '@/db';
import type { Invoice, Product } from '@/db/types';
import { useI18n } from '@/i18n';
import { abilities } from '@/lib/access';
import { formatMoney, formatToday, greetingKey, localizedName, shopTitle } from '@/lib/format';
import { useSession } from '@/state/session';
import { colors } from '@/theme';

type Dash = Awaited<ReturnType<typeof dashboard>>;

export default function HomeScreen() {
  const { t, lang } = useI18n();
  const { settings, user, version } = useSession();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<Dash | null>(null);
  const can = abilities(user?.role ?? 'cashier');

  const load = useCallback(() => {
    dashboard().then(setData).catch(() => undefined);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load, version]),
  );

  if (!settings || !user) return null;

  const actions = [
    { icon: 'flash' as const, label: t('quickSale'), href: '/quick-sale' },
    { icon: 'cart' as const, label: t('posSale'), href: '/sale' },
    can.purchases ? { icon: 'download-outline' as const, label: t('purchases'), href: '/purchase/form' } : null,
    can.expenses ? { icon: 'wallet-outline' as const, label: t('expenses'), href: '/expense/form' } : null,
    { icon: 'return-down-back' as const, label: t('returns'), href: '/return/new' },
    { icon: 'cash-outline' as const, label: t('drawer'), href: '/drawer' },
    { icon: 'people-outline' as const, label: t('parties'), href: '/parties' },
  ].filter((item) => item !== null);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 24 }}>
      <View style={[styles.hero, { paddingTop: insets.top + 12 }]}>
        <View style={styles.top}>
          <View style={styles.flex}>
            <T weight="bold" style={styles.shop} numberOfLines={1}>
              {shopTitle(settings, lang)}
            </T>
            <T style={styles.hello}>
              {t(greetingKey())}, {user.name}
            </T>
          </View>
          <LanguageSwitch />
        </View>
        <T style={styles.date}>{formatToday(lang)}</T>
        <T style={styles.saleLabel}>{t('todaySale')}</T>
        <T weight="bold" style={styles.sale}>
          {formatMoney(data?.saleTotal ?? 0)}
        </T>
        <T style={styles.hello}>{t('billsCount', { count: data?.billCount ?? 0 })}</T>
      </View>

      <View style={styles.sheet}>
        <View style={styles.metrics}>
          {can.profit ? <Metric label={t('profit')} value={formatMoney(data?.profit ?? 0)} /> : <Metric label={t('cashSales')} value={formatMoney(data?.cashCollected ?? 0)} />}
          <Metric label={t('toCollect')} value={formatMoney(data?.receivable ?? 0)} />
          <Metric label={data?.drawerOpen ? t('inDrawer') : t('drawerClosed')} value={data?.drawerOpen ? formatMoney(data.drawerExpected) : '—'} />
          {can.payables ? <Metric label={t('toPay')} value={formatMoney(data?.payable ?? 0)} /> : <Metric label={t('returnsToday')} value={formatMoney(data?.returnTotal ?? 0)} />}
        </View>

        <T weight="bold" style={styles.h}>
          {t('quick')}
        </T>
        <View style={styles.actions}>
          {actions.map((action) => (
            <Pressable key={action.href + action.label} onPress={() => router.push(action.href as never)} style={styles.action}>
              <View style={styles.bubble}>
                <Ionicons name={action.icon} size={20} color={colors.greenDark} />
              </View>
              <T style={styles.actionLabel} numberOfLines={2}>
                {action.label}
              </T>
            </Pressable>
          ))}
        </View>

        <T weight="bold" style={styles.h}>
          {t('lowStock')}
        </T>
        {data && data.lowStock.length === 0 ? <T style={styles.muted}>{t('lowStockOk')}</T> : null}
        {data?.lowStock.map((product) => (
          <StockRow key={product.id} product={product} lang={lang} />
        ))}

        <View style={styles.rowBetween}>
          <T weight="bold" style={styles.h}>
            {t('recentBills')}
          </T>
          <Pressable onPress={() => router.push('/invoices')}>
            <T weight="semi" style={styles.link}>
              {t('viewAll')}
            </T>
          </Pressable>
        </View>
        {data && data.recent.length === 0 ? (
          <Pressable onPress={() => router.push('/quick-sale')} style={styles.empty}>
            <T weight="semi">{t('noBills')}</T>
            <T style={styles.link}>{t('firstBill')}</T>
          </Pressable>
        ) : null}
        {data?.recent.map((invoice) => (
          <BillRow key={invoice.id} invoice={invoice} onPress={() => router.push({ pathname: '/invoice/[id]', params: { id: invoice.id } })} />
        ))}
      </View>
    </ScrollView>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <T style={styles.muted}>{label}</T>
      <T weight="bold" style={styles.metricValue} numberOfLines={1}>
        {value}
      </T>
    </View>
  );
}

function StockRow({ product, lang }: { product: Product; lang: 'en' | 'gu' }) {
  return (
    <View style={styles.line}>
      <T style={styles.flex} numberOfLines={1}>
        {localizedName(product, lang)}
      </T>
      <T weight="semi" style={{ color: product.stock <= 0 ? colors.red : colors.gold }}>
        {product.stock}
      </T>
    </View>
  );
}

function BillRow({ invoice, onPress }: { invoice: Invoice; onPress: () => void }) {
  const { t } = useI18n();
  return (
    <Pressable onPress={onPress} style={styles.line}>
      <View style={styles.flex}>
        <T weight="semi">{invoice.number}</T>
        <T style={styles.muted}>{invoice.partyName || t('walkIn')}</T>
      </View>
      <View style={styles.end}>
        <T weight="bold">{formatMoney(invoice.total)}</T>
        <Pill status={invoice.status} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  hero: { backgroundColor: colors.green, paddingHorizontal: 16, paddingBottom: 36, gap: 4 },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  flex: { flex: 1 },
  shop: { color: colors.white, fontSize: 22 },
  hello: { color: '#E7F6EE' },
  date: { color: '#D5EDE1', marginTop: 8 },
  saleLabel: { color: '#E7F6EE', marginTop: 16 },
  sale: { color: colors.white, fontSize: 36 },
  sheet: { marginTop: -18, backgroundColor: colors.bg, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16, gap: 8 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metric: { width: '48%', flexGrow: 1, backgroundColor: colors.white, borderRadius: 16, borderWidth: 1, borderColor: colors.line, padding: 12, gap: 4 },
  metricValue: { fontSize: 18 },
  h: { fontSize: 18, marginTop: 8 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  action: { width: '31%', flexGrow: 1, backgroundColor: colors.white, borderRadius: 16, borderWidth: 1, borderColor: colors.line, padding: 10, gap: 8, minHeight: 86 },
  bubble: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 13 },
  muted: { color: colors.muted, fontSize: 13 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.white, borderRadius: 14, borderWidth: 1, borderColor: colors.line, padding: 12 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  link: { color: colors.greenDark },
  empty: { padding: 16, borderRadius: 14, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, gap: 4 },
  end: { alignItems: 'flex-end', gap: 4 },
});

import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Choice, Screen, T } from '@/components/ui';
import { report } from '@/db';
import { useI18n } from '@/i18n';
import { formatDate, formatMoney, formatQty, localizedName } from '@/lib/format';
import { colors } from '@/theme';

type ReportData = Awaited<ReturnType<typeof report>>;

export default function ReportsScreen() {
  const { t, lang } = useI18n();
  const [preset, setPreset] = useState<'today' | 'week' | 'month'>('today');
  const [data, setData] = useState<ReportData | null>(null);

  useEffect(() => {
    report(preset).then(setData).catch(() => undefined);
  }, [preset]);

  const max = Math.max(...(data?.days.map((day) => day.total) ?? [1]), 1);

  return (
    <Screen scroll>
      <Stack.Screen options={{ title: t('reports') }} />
      <Choice
        options={[
          { id: 'today', label: t('today') },
          { id: 'week', label: t('week') },
          { id: 'month', label: t('month') },
        ]}
        value={preset}
        onChange={(id) => setPreset(id as 'today' | 'week' | 'month')}
      />
      <View style={styles.grid}>
        <Tile label={t('periodSales')} value={formatMoney(data?.sales ?? 0)} />
        <Tile label={t('periodProfit')} value={formatMoney(data?.profit ?? 0)} />
        <Tile label={t('periodPurchases')} value={formatMoney(data?.purchases ?? 0)} />
        <Tile label={t('periodExpenses')} value={formatMoney(data?.expenses ?? 0)} />
        <Tile label={t('periodReturns')} value={formatMoney(data?.returns ?? 0)} />
        <Tile label={t('taxCollected')} value={formatMoney(data?.tax ?? 0)} />
      </View>
      <T style={styles.muted}>{t('estimated')}</T>
      <T weight="bold">{t('last7')}</T>
      {data?.days.map((day) => (
        <View key={day.date} style={styles.barRow}>
          <T style={styles.day}>{formatDate(day.date, lang).split(' ').slice(0, 2).join(' ')}</T>
          <View style={styles.track}>
            <View style={[styles.bar, { width: `${Math.max(4, (day.total / max) * 100)}%` }]} />
          </View>
          <T style={styles.amt}>{formatMoney(day.total)}</T>
        </View>
      ))}
      <T weight="bold">{t('topItems')}</T>
      {data && data.top.length === 0 ? <T style={styles.muted}>{t('noSales')}</T> : null}
      {data?.top.map((item) => (
        <View key={item.name} style={styles.line}>
          <T style={styles.flex}>{localizedName(item, lang)}</T>
          <T style={styles.muted}>{formatQty(item.qty)}</T>
          <T weight="semi">{formatMoney(item.amount)}</T>
        </View>
      ))}
    </Screen>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.tile}>
      <T style={styles.muted}>{label}</T>
      <T weight="bold">{value}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { width: '48%', flexGrow: 1, backgroundColor: colors.white, borderRadius: 16, borderWidth: 1, borderColor: colors.line, padding: 12, gap: 4 },
  muted: { color: colors.muted, fontSize: 13 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  day: { width: 72, fontSize: 12, color: colors.muted },
  track: { flex: 1, height: 8, backgroundColor: colors.greenSoft, borderRadius: 99, overflow: 'hidden' },
  bar: { height: 8, backgroundColor: colors.green, borderRadius: 99 },
  amt: { width: 88, textAlign: 'right', fontSize: 12 },
  line: { flexDirection: 'row', gap: 8, alignItems: 'center', padding: 12, borderRadius: 14, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  flex: { flex: 1 },
});

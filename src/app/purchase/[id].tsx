import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Screen, T } from '@/components/ui';
import { getPurchase } from '@/db';
import type { Purchase, PurchaseItem } from '@/db/types';
import { useI18n } from '@/i18n';
import { formatDate, formatMoney, formatQty, localizedName } from '@/lib/format';
import { modeLabel } from '@/components/ui';
import { colors } from '@/theme';

export default function PurchaseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, lang } = useI18n();
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [items, setItems] = useState<PurchaseItem[]>([]);

  useEffect(() => {
    if (!id) return;
    getPurchase(id).then((found) => {
      setPurchase(found?.purchase ?? null);
      setItems(found?.items ?? []);
    });
  }, [id]);

  if (!purchase) {
    return <Screen><Stack.Screen options={{ title: t('purchases') }} /><T>{t('emptyList')}</T></Screen>;
  }

  return (
    <Screen scroll>
      <Stack.Screen options={{ title: purchase.number }} />
      <T weight="bold" style={styles.total}>{formatMoney(purchase.total)}</T>
      <T style={styles.muted}>{formatDate(purchase.date, lang)} · {purchase.partyName || t('none')}</T>
      <T style={styles.muted}>{modeLabel(purchase.paymentMode, t)} · {t('due')} {formatMoney(purchase.due)}</T>
      {items.map((item) => (
        <View key={item.id} style={styles.line}>
          <T weight="semi">{localizedName(item, lang)}</T>
          <T style={styles.muted}>{formatQty(item.qty)} × {formatMoney(item.rate)}</T>
          <T weight="bold">{formatMoney(item.total)}</T>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  total: { fontSize: 28 },
  muted: { color: colors.muted },
  line: { padding: 12, borderRadius: 14, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, gap: 2 },
});

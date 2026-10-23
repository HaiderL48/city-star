import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { MenuRow, T } from '@/components/ui';
import { dashboard } from '@/db';
import { useI18n } from '@/i18n';
import { abilities } from '@/lib/access';
import { formatMoney } from '@/lib/format';
import { useSession } from '@/state/session';
import { colors } from '@/theme';

export default function BooksScreen() {
  const { t } = useI18n();
  const { user, version } = useSession();
  const router = useRouter();
  const can = abilities(user?.role ?? 'cashier');
  const [figures, setFigures] = useState({ receivable: 0, payable: 0, drawer: '' });

  useFocusEffect(
    useCallback(() => {
      dashboard()
        .then((data) =>
          setFigures({
            receivable: data.receivable,
            payable: data.payable,
            drawer: data.drawerOpen ? formatMoney(data.drawerExpected) : t('drawerClosed'),
          }),
        )
        .catch(() => undefined);
    }, [t, version]),
  );

  return (
    <ScrollView contentContainerStyle={styles.list}>
      <T style={styles.hint}>{t('booksHint')}</T>
      <MenuRow icon="receipt-outline" title={t('invoices')} onPress={() => router.push('/invoices')} />
      {can.purchases ? <MenuRow icon="download-outline" title={t('purchases')} detail={can.payables ? formatMoney(figures.payable) : undefined} onPress={() => router.push('/purchases')} /> : null}
      {can.expenses ? <MenuRow icon="wallet-outline" title={t('expenses')} onPress={() => router.push('/expenses')} /> : null}
      <MenuRow icon="return-down-back" title={t('returns')} onPress={() => router.push('/returns')} />
      <MenuRow icon="cash-outline" title={t('drawer')} detail={figures.drawer} onPress={() => router.push('/drawer')} />
      <MenuRow icon="people-outline" title={t('parties')} detail={formatMoney(figures.receivable)} onPress={() => router.push('/parties')} />
      {can.reports ? <MenuRow icon="bar-chart-outline" title={t('reports')} onPress={() => router.push('/reports')} /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 10 },
  hint: { color: colors.muted },
});

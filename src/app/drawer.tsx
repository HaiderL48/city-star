import { Stack } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { Button, Field, Screen, T } from '@/components/ui';
import { closeDrawer, drawerState, openDrawer, recordCash } from '@/db';
import { kickDrawer as kickPrinter } from '@/print/printer';
import type { CashMove, CashSession } from '@/db/types';
import { useI18n } from '@/i18n';
import { errorKey } from '@/lib/errors';
import { formatMoney, formatWhen, num } from '@/lib/format';
import { useSession } from '@/state/session';
import { colors } from '@/theme';

export default function DrawerScreen() {
  const { t, lang } = useI18n();
  const { user, settings, notify, version } = useSession();
  const [session, setSession] = useState<CashSession | null>(null);
  const [moves, setMoves] = useState<CashMove[]>([]);
  const [expected, setExpected] = useState(0);
  const [opening, setOpening] = useState('');
  const [counted, setCounted] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    drawerState().then((state) => {
      setSession(state.session);
      setMoves(state.moves);
      setExpected(state.expected);
    });
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load, version]));

  const run = async (work: () => Promise<void>) => {
    if (!user) return;
    setBusy(true);
    try {
      await work();
      notify();
      load();
      setAmount('');
      setNote('');
    } catch (error) {
      Alert.alert(t('failedTitle'), t(errorKey(error)));
    } finally {
      setBusy(false);
    }
  };

  const labelFor = (move: CashMove) => {
    if (move.kind === 'sale') return t('saleIn');
    if (move.kind === 'purchase') return t('purchaseOut');
    if (move.kind === 'expense') return t('expenseOut');
    if (move.kind === 'return') return t('returnOut');
    return move.direction === 'in' ? t('manualIn') : t('manualOut');
  };

  return (
    <Screen scroll>
      <Stack.Screen options={{ title: t('drawer') }} />
      {!session ? (
        <>
          <T style={styles.muted}>{t('openToCount')}</T>
          <Field label={t('openingCash')} value={opening} onChangeText={setOpening} keyboardType="decimal-pad" />
          <Field label={t('noteOptional')} value={note} onChangeText={setNote} />
          <Button label={busy ? t('working') : t('openDrawer')} disabled={busy} onPress={() => run(async () => { await openDrawer(num(opening), note, user!); })} />
        </>
      ) : (
        <>
          <T style={styles.muted}>{t('expectedNow')}</T>
          <T weight="bold" style={styles.big}>{formatMoney(expected)}</T>
          <T style={styles.muted}>{t('opening')} {formatMoney(session.openingCash)} · {session.userName}</T>
          <Field label={t('movementAmount')} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
          <Field label={t('movementNote')} value={note} onChangeText={setNote} />
          <View style={styles.row}>
            <View style={styles.flex}><Button label={t('cashIn')} kind="secondary" disabled={busy} onPress={() => run(() => recordCash('in', num(amount), note))} /></View>
            <View style={styles.flex}><Button label={t('cashOut')} kind="secondary" disabled={busy} onPress={() => run(() => recordCash('out', num(amount), note))} /></View>
          </View>
          <T weight="bold">{t('movements')}</T>
          {moves.length === 0 ? <T style={styles.muted}>{t('noMoves')}</T> : null}
          {moves.map((move) => (
            <View key={move.id} style={styles.line}>
              <View style={styles.flex}>
                <T weight="semi">{labelFor(move)}</T>
                <T style={styles.muted}>{formatWhen(move.createdAt, lang)} {move.note}</T>
              </View>
              <T weight="bold" style={{ color: move.direction === 'in' ? colors.greenDark : colors.red }}>
                {move.direction === 'in' ? '+' : '-'}{formatMoney(move.amount)}
              </T>
            </View>
          ))}
          <Field label={t('countedCash')} value={counted} onChangeText={setCounted} keyboardType="decimal-pad" />
          <T style={styles.muted}>{t('countHelp')}</T>
          {counted !== '' ? (
            <T>
              {Math.abs(num(counted) - expected) < 0.01
                ? t('matched')
                : num(counted) > expected
                  ? t('extraBy', { amount: formatMoney(num(counted) - expected) })
                  : t('shortBy', { amount: formatMoney(expected - num(counted)) })}
            </T>
          ) : null}
          <Button label={busy ? t('working') : t('countClose')} disabled={busy} onPress={() => run(() => closeDrawer(num(counted), note))} />
        </>
      )}
      <Button
        label={t('kickDrawer')}
        kind="ghost"
        onPress={() => {
          if (!settings?.printerAddress) {
            Alert.alert(t('printerTitle'), t('connectFirst'));
            return;
          }
          kickPrinter(settings.printerAddress).then(() => Alert.alert(t('kickDrawer'), t('yesPrint'))).catch((error) => Alert.alert(t('printFailed'), t(errorKey(error))));
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { color: colors.muted },
  big: { fontSize: 32 },
  row: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
  line: { flexDirection: 'row', gap: 8, padding: 12, borderRadius: 14, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
});

import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { Button, Choice, Field, Screen } from '@/components/ui';
import { createExpense } from '@/db';
import type { Expense } from '@/db/types';
import { useI18n } from '@/i18n';
import { EXPENSE_CATEGORIES } from '@/lib/catalog';
import { errorKey } from '@/lib/errors';
import { num } from '@/lib/format';
import { expenseLabel } from '@/print/model';
import { useSession } from '@/state/session';

export default function ExpenseForm() {
  const { t } = useI18n();
  const { user, notify } = useSession();
  const router = useRouter();
  const [category, setCategory] = useState<string>('rent');
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState<Expense['paymentMode']>('cash');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!user) return;
    setBusy(true);
    try {
      await createExpense({ category, amount: num(amount), paymentMode: mode, note, user });
      notify();
      router.back();
    } catch (error) {
      Alert.alert(t('failedTitle'), t(errorKey(error)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll>
      <Stack.Screen options={{ title: t('newExpense') }} />
      <Choice options={EXPENSE_CATEGORIES.map((item) => ({ id: item, label: expenseLabel(item, t) }))} value={category} onChange={setCategory} />
      <Field label={t('amount')} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
      <Choice
        options={(['cash', 'upi', 'card'] as const).map((item) => ({ id: item, label: t(item) }))}
        value={mode}
        onChange={(id) => setMode(id as Expense['paymentMode'])}
      />
      <Field label={t('note')} value={note} onChangeText={setNote} />
      <Button label={busy ? t('working') : t('saveExpense')} onPress={save} disabled={busy} />
    </Screen>
  );
}

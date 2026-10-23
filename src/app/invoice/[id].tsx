import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Button, Field, Pill, ReceiptCard, Screen, T, modeLabel } from '@/components/ui';
import { getInvoice, receiveOnInvoice, returnsForInvoice } from '@/db';
import type { Invoice, InvoiceItem, SaleReturn } from '@/db/types';
import { useI18n } from '@/i18n';
import { errorKey } from '@/lib/errors';
import { formatDate, formatMoney, localizedName } from '@/lib/format';
import { makeReceipt } from '@/print/model';
import { captureReceipt, paperDots, printReceipt } from '@/print/printer';
import { sendWhatsapp, sharePdf } from '@/print/share';
import { useSession } from '@/state/session';
import { colors } from '@/theme';

export default function InvoiceScreen() {
  const { id, action } = useLocalSearchParams<{ id: string; action?: string }>();
  const { t, lang } = useI18n();
  const { settings, user, notify } = useSession();
  const router = useRouter();
  const shot = useRef<View>(null);
  const handled = useRef(false);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [returns, setReturns] = useState<SaleReturn[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [payAmount, setPayAmount] = useState('');

  const load = async () => {
    if (!id) return;
    const found = await getInvoice(id);
    setInvoice(found?.invoice ?? null);
    setItems(found?.items ?? []);
    setReturns(await returnsForInvoice(id));
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, [id]);

  const model = invoice && settings ? makeReceipt(invoice, items, settings, lang, t, modeLabel(invoice.paymentMode, t)) : null;

  const doPrint = async () => {
    if (!model || !settings) return;
    setBusy(true);
    try {
      const base64 = await captureReceipt(shot);
      await printReceipt({ address: settings.printerAddress, paper: settings.paperWidth, model, base64 });
      Alert.alert(t('printReceipt'), t('yesPrint'));
    } catch (error) {
      Alert.alert(t('printFailed'), t(errorKey(error)));
    } finally {
      setBusy(false);
    }
  };

  const doWhatsapp = async () => {
    if (!model || !invoice) return;
    if (!invoice.partyPhone) Alert.alert(t('sendWhatsapp'), t('noPhone'));
    try {
      await sendWhatsapp(invoice.partyPhone, model);
    } catch {
      Alert.alert(t('failedTitle'), t('whatsappFailed'));
    }
  };

  const doPdf = async () => {
    if (!model) return;
    try {
      await sharePdf(model, invoice?.number ?? t('receipt'));
    } catch (error) {
      Alert.alert(t('failedTitle'), t(errorKey(error)));
    }
  };

  useEffect(() => {
    if (!model || handled.current) return;
    if (action === 'print') {
      handled.current = true;
      void doPrint();
    } else if (action === 'whatsapp') {
      handled.current = true;
      void doWhatsapp();
    }
  }, [model, action]);

  if (loading || !settings) {
    return (
      <Screen>
        <Stack.Screen options={{ title: t('bill') }} />
        <T>{t('working')}</T>
      </Screen>
    );
  }

  if (!invoice || !model) {
    return (
      <Screen>
        <Stack.Screen options={{ title: t('bill') }} />
        <T>{t('invoiceMissing')}</T>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Stack.Screen options={{ title: invoice.number }} />
      <View style={styles.head}>
        <T weight="bold" style={styles.total}>{formatMoney(invoice.total)}</T>
        <Pill status={invoice.status} />
      </View>
      <T style={styles.muted}>{formatDate(invoice.date, lang)} · {invoice.partyName || t('walkIn')}</T>
      <T style={styles.muted}>{t('createdBy')} {invoice.userName}</T>
      {invoice.note ? <T>{invoice.note}</T> : null}
      <View style={styles.paper}>
        <ReceiptCard model={model} width={320} />
      </View>
      <View style={styles.hidden} pointerEvents="none">
        <ReceiptCard ref={shot} model={model} width={paperDots(settings.paperWidth)} />
      </View>
      <Button label={busy ? t('printing') : t('printReceipt')} onPress={doPrint} disabled={busy} icon="print-outline" />
      <Button label={t('sendWhatsapp')} kind="secondary" onPress={doWhatsapp} icon="logo-whatsapp" />
      <Button label={t('sharePdf')} kind="secondary" onPress={doPdf} icon="document-text-outline" />
      {invoice.due > 0.001 && user ? (
        <View style={styles.lines}>
          <Field label={t('thisDue')} value={payAmount} onChangeText={setPayAmount} keyboardType="decimal-pad" placeholder={formatMoney(invoice.due)} />
          <Button
            label={t('receiveOnBill')}
            kind="secondary"
            onPress={async () => {
              try {
                await receiveOnInvoice(invoice.id, Number(payAmount), 'cash', user);
                setPayAmount('');
                notify();
                await load();
              } catch (error) {
                Alert.alert(t('failedTitle'), t(errorKey(error)));
              }
            }}
          />
        </View>
      ) : null}
      <Button label={t('newReturn')} kind="ghost" onPress={() => router.push({ pathname: '/return/new', params: { invoiceId: invoice.id } })} />
      <T weight="semi">{t('linkedReturn')}</T>
      {returns.length === 0 ? <T style={styles.muted}>{t('noReturnsOnBill')}</T> : null}
      {returns.map((item) => (
        <T key={item.id}>
          {item.number} · {formatMoney(item.total)}
        </T>
      ))}
      <View style={styles.lines}>
        {items.map((item) => (
          <T key={item.id} style={styles.muted}>
            {localizedName(item, lang)} · {t('alreadyBack')} {item.returnedQty}
          </T>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  total: { fontSize: 28 },
  muted: { color: colors.muted },
  paper: { alignItems: 'center', backgroundColor: colors.white, borderRadius: 16, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  hidden: { position: 'absolute', left: -4000, top: 0 },
  lines: { gap: 4 },
});

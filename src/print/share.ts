import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Linking, Platform } from 'react-native';

import { escapeHtml, waLink } from '@/lib/format';

export type ReceiptLine = {
  name: string;
  detail: string;
  amount: string;
};

export type ReceiptModel = {
  shopName: string;
  phone: string;
  address: string;
  gstin: string;
  number: string;
  date: string;
  party: string;
  lines: ReceiptLine[];
  rows: { label: string; value: string }[];
  totalLabel: string;
  total: string;
  thanks: string;
  footer: string;
};

export function receiptPlain(model: ReceiptModel) {
  const lines = [
    model.shopName,
    model.number,
    model.date,
    model.party,
    '',
    ...model.lines.flatMap((line) => [line.name, `${line.detail}  ${line.amount}`]),
    '',
    ...model.rows.map((row) => `${row.label}: ${row.value}`),
    `${model.totalLabel}: ${model.total}`,
    '',
    model.thanks,
  ];
  return lines.filter((line) => line !== undefined).join('\n');
}

export function receiptHtml(model: ReceiptModel) {
  const rows = model.lines
    .map(
      (line) =>
        `<tr><td><strong>${escapeHtml(line.name)}</strong><br/><span>${escapeHtml(line.detail)}</span></td><td class="amt">${escapeHtml(line.amount)}</td></tr>`,
    )
    .join('');
  const summary = model.rows
    .map((row) => `<div class="row"><span>${escapeHtml(row.label)}</span><span>${escapeHtml(row.value)}</span></div>`)
    .join('');
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  body { font-family: "Noto Sans Gujarati", "Nirmala UI", sans-serif; color: #13241c; margin: 32px; }
  h1 { font-size: 28px; margin: 0; }
  .muted { color: #5c6b63; font-size: 14px; }
  table { width: 100%; border-collapse: collapse; margin-top: 18px; }
  td { border-top: 1px solid #e1e8e3; padding: 8px 0; vertical-align: top; }
  .amt { text-align: right; white-space: nowrap; }
  .row, .total { display: flex; justify-content: space-between; margin-top: 6px; }
  .total { font-size: 20px; font-weight: 700; margin-top: 12px; }
  .thanks { margin-top: 28px; text-align: center; }
</style>
</head>
<body>
  <h1>${escapeHtml(model.shopName)}</h1>
  <div class="muted">${escapeHtml([model.address, model.phone, model.gstin].filter(Boolean).join(' · '))}</div>
  <div class="muted">${escapeHtml(model.number)} · ${escapeHtml(model.date)}</div>
  <div>${escapeHtml(model.party)}</div>
  <table>${rows}</table>
  ${summary}
  <div class="total"><span>${escapeHtml(model.totalLabel)}</span><span>${escapeHtml(model.total)}</span></div>
  <div class="thanks">${escapeHtml(model.thanks)}<br/>${escapeHtml(model.footer)}</div>
</body>
</html>`;
}

export async function sendWhatsapp(phone: string, model: ReceiptModel) {
  const url = waLink(phone, receiptPlain(model));
  const opened = await Linking.openURL(url).then(
    () => true,
    () => false,
  );
  if (!opened) throw new Error('whatsapp_failed');
}

export async function sharePdf(model: ReceiptModel, title: string) {
  const html = receiptHtml(model);
  if (Platform.OS === 'web') {
    await Print.printAsync({ html });
    return;
  }
  const file = await Print.printToFileAsync({ html });
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    await Print.printAsync({ html });
    return;
  }
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: title,
  });
}

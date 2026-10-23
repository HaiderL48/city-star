import type { Invoice, InvoiceItem, Settings } from '@/db/types';
import type { Key } from '@/i18n';
import { formatDate, formatMoney, formatQty, localizedName, shopTitle, type Lang } from '@/lib/format';
import type { ReceiptModel } from '@/print/share';

const UNITS: Record<string, Key> = {
  pcs: 'unit_pcs',
  kg: 'unit_kg',
  g: 'unit_g',
  ltr: 'unit_ltr',
  ml: 'unit_ml',
  box: 'unit_box',
  dozen: 'unit_dozen',
};

export function unitLabel(unit: string, t: (key: Key) => string) {
  return UNITS[unit] ? t(UNITS[unit]) : unit;
}

export function categoryLabel(category: string, t: (key: Key) => string) {
  const known: Record<string, Key> = {
    grocery: 'grocery',
    dairy: 'dairy',
    personal: 'personal',
    otherCat: 'otherCat',
  };
  return known[category] ? t(known[category]) : category;
}

export function ledgerLabel(kind: string, t: (key: Key) => string) {
  const known: Record<string, Key> = {
    sale: 'saleWord',
    purchase: 'purchaseWord',
    payment_in: 'paymentIn',
    payment_out: 'paymentOut',
    return: 'returnWord',
    opening: 'openingWord',
  };
  return known[kind] ? t(known[kind]) : t('unknown');
}

export function expenseLabel(category: string, t: (key: Key) => string) {
  const known: Record<string, Key> = {
    rent: 'rent',
    salary: 'salary',
    electricity: 'electricity',
    transport: 'transport',
    refreshments: 'refreshments',
    other: 'other',
  };
  return known[category] ? t(known[category]) : category;
}

export function makeReceipt(
  invoice: Invoice,
  items: InvoiceItem[],
  settings: Settings,
  lang: Lang,
  t: (key: Key, options?: Record<string, string | number>) => string,
  mode: string,
): ReceiptModel {
  const rows = [
    { label: t('taxableLine'), value: formatMoney(invoice.subtotal) },
    { label: t('gstLine'), value: formatMoney(invoice.tax) },
  ];
  if (invoice.discount > 0) rows.push({ label: t('discountLine'), value: formatMoney(invoice.discount) });
  rows.push({ label: t('paidLine'), value: formatMoney(invoice.paid) });
  if (invoice.due > 0.001) rows.push({ label: t('dueLine'), value: formatMoney(invoice.due) });
  rows.push({ label: t('modeLine'), value: mode });
  return {
    shopName: shopTitle(settings, lang),
    phone: settings.phone ? `${t('phoneLine')} ${settings.phone}` : '',
    address: settings.address,
    gstin: settings.gstin ? `${t('gstinLine')} ${settings.gstin}` : '',
    number: `${t('simpleBill')} ${invoice.number}`,
    date: formatDate(invoice.date, lang),
    party: `${t('customerLine')}: ${invoice.partyName || t('walkIn')}`,
    lines: items.map((item) => ({
      name: localizedName(item, lang),
      detail: `${formatQty(item.qty)} ${unitLabel(item.unit, t)} × ${formatMoney(item.rate)}`,
      amount: formatMoney(item.total),
    })),
    rows,
    totalLabel: t('grandTotal'),
    total: formatMoney(invoice.total),
    thanks: t('footerThanks'),
    footer: settings.gstin ? t('billTitle') : t('computer'),
  };
}

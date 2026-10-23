import { round2 } from '@/lib/format';

export type PriceLine = {
  qty: number;
  rate: number;
  gstRate: number;
};

export type ComputedLine = PriceLine & {
  taxable: number;
  tax: number;
  total: number;
};

export function computeLine(qty: number, rate: number, gstRate: number, taxInclusive: boolean) {
  const base = round2(qty * rate);
  const gst = Math.max(0, gstRate);
  if (taxInclusive) {
    const taxable = round2((base * 100) / (100 + gst));
    const tax = round2(base - taxable);
    return { taxable, tax, total: base };
  }
  const tax = round2((base * gst) / 100);
  return { taxable: base, tax, total: round2(base + tax) };
}

export function computeBill(lines: PriceLine[], discount: number, taxInclusive: boolean) {
  const items: ComputedLine[] = lines.map((line) => ({
    ...line,
    ...computeLine(line.qty, line.rate, line.gstRate, taxInclusive),
  }));
  const subtotal = round2(items.reduce((sum, item) => sum + item.taxable, 0));
  const gross = round2(items.reduce((sum, item) => sum + item.total, 0));
  const tax = round2(gross - subtotal);
  const disc = round2(Math.min(Math.max(0, discount), gross));
  const total = round2(Math.max(0, gross - disc));
  return { items, subtotal, tax, discount: disc, gross, total };
}

export function splitRefund(due: number, returnTotal: number, mode: 'cash' | 'upi' | 'credit') {
  const safeDue = Math.max(0, due);
  const dueCut = round2(Math.min(safeDue, returnTotal));
  const payout = round2(Math.max(0, returnTotal - dueCut));
  return {
    dueCut,
    balanceCut: mode === 'credit' ? returnTotal : dueCut,
    cashOut: mode === 'cash' ? payout : 0,
    payout,
  };
}

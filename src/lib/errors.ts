import type { Key } from '@/i18n/strings';

const messages: Record<string, Key> = {
  shop_required: 'shopRequired',
  name_required: 'nameRequired',
  pin_rule: 'pinRule',
  pin_used: 'pinUsed',
  last_admin: 'lastAdmin',
  customer_required: 'customerRequired',
  supplier_required: 'supplierRequired',
  empty_cart: 'emptyCart',
  amount_short: 'amountShort',
  amount_high: 'amountTooHigh',
  invalid_amount: 'invalidAmount',
  nothing_to_return: 'nothingToReturn',
  pick_one: 'pickOne',
  must_open_drawer: 'mustOpenDrawer',
  has_balance: 'hasBalance',
  has_history: 'hasHistory',
  name_mismatch: 'nameMismatch',
  connect_first: 'connectFirst',
  print_failed: 'printFailed',
  needs_build: 'needsBuild',
  web_only: 'webOnly',
  phone_invalid: 'phoneInvalid',
  invoice_missing: 'invoiceMissing',
  product_missing: 'productMissing',
  party_missing: 'partyMissing',
  already_open: 'alreadyOpen',
  counted_required: 'countedRequired',
  opening_required: 'openingRequired',
  cannot_exceed: 'cannotExceed',
  rate_required: 'rateRequired',
  qty_required: 'qtyRequired',
  at_least_one: 'atLeastOne',
  disabled: 'disabled',
  permission: 'permission',
  timeout: 'timeout',
  network: 'network',
};

export function errorKey(error: unknown): Key {
  const code = error instanceof Error ? error.message : '';
  return messages[code] ?? 'failed';
}

export function fail(code: string): never {
  throw new Error(code);
}

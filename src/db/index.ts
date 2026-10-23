import * as Crypto from 'expo-crypto';
import * as SQLite from 'expo-sqlite';

import { fail } from '@/lib/errors';
import { last7Days, nowIso, rangeFor, round2, round3, todayKey, uid, type Lang } from '@/lib/format';
import { computeBill, splitRefund } from '@/lib/pricing';
import type {
  Actor,
  BillStatus,
  CartInput,
  CashMove,
  CashSession,
  Expense,
  Invoice,
  InvoiceItem,
  LedgerEntry,
  PaperWidth,
  Party,
  PartyKind,
  PayMode,
  Product,
  Purchase,
  PurchaseItem,
  Role,
  SaleReturn,
  Settings,
  User,
} from '@/db/types';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS parties (
  id TEXT PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  gstin TEXT NOT NULL DEFAULT '',
  balance REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ledger (
  id TEXT PRIMARY KEY NOT NULL,
  party_id TEXT NOT NULL,
  date TEXT NOT NULL,
  kind TEXT NOT NULL,
  ref_id TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  debit REAL NOT NULL DEFAULT 0,
  credit REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  name_gu TEXT NOT NULL DEFAULT '',
  sku TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  unit TEXT NOT NULL DEFAULT 'pcs',
  sale_price REAL NOT NULL,
  purchase_price REAL NOT NULL DEFAULT 0,
  gst_rate REAL NOT NULL DEFAULT 0,
  stock REAL NOT NULL DEFAULT 0,
  low_stock REAL NOT NULL DEFAULT 5,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY NOT NULL,
  number TEXT NOT NULL,
  date TEXT NOT NULL,
  party_id TEXT,
  party_name TEXT NOT NULL DEFAULT '',
  party_phone TEXT NOT NULL DEFAULT '',
  subtotal REAL NOT NULL,
  tax REAL NOT NULL,
  discount REAL NOT NULL,
  total REAL NOT NULL,
  paid REAL NOT NULL,
  due REAL NOT NULL,
  payment_mode TEXT NOT NULL,
  status TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  user_id TEXT NOT NULL DEFAULT '',
  user_name TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS invoice_items (
  id TEXT PRIMARY KEY NOT NULL,
  invoice_id TEXT NOT NULL,
  product_id TEXT,
  name TEXT NOT NULL,
  name_gu TEXT NOT NULL DEFAULT '',
  unit TEXT NOT NULL DEFAULT 'pcs',
  qty REAL NOT NULL,
  returned_qty REAL NOT NULL DEFAULT 0,
  rate REAL NOT NULL,
  gst_rate REAL NOT NULL DEFAULT 0,
  taxable REAL NOT NULL,
  tax REAL NOT NULL,
  total REAL NOT NULL,
  purchase_price REAL NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS purchases (
  id TEXT PRIMARY KEY NOT NULL,
  number TEXT NOT NULL,
  date TEXT NOT NULL,
  party_id TEXT,
  party_name TEXT NOT NULL DEFAULT '',
  subtotal REAL NOT NULL,
  tax REAL NOT NULL,
  total REAL NOT NULL,
  paid REAL NOT NULL,
  due REAL NOT NULL,
  payment_mode TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'paid',
  note TEXT NOT NULL DEFAULT '',
  user_id TEXT NOT NULL DEFAULT '',
  user_name TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS purchase_items (
  id TEXT PRIMARY KEY NOT NULL,
  purchase_id TEXT NOT NULL,
  product_id TEXT,
  name TEXT NOT NULL,
  name_gu TEXT NOT NULL DEFAULT '',
  unit TEXT NOT NULL DEFAULT 'pcs',
  qty REAL NOT NULL,
  rate REAL NOT NULL,
  gst_rate REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY NOT NULL,
  date TEXT NOT NULL,
  category TEXT NOT NULL,
  amount REAL NOT NULL,
  payment_mode TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  user_id TEXT NOT NULL DEFAULT '',
  user_name TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS returns (
  id TEXT PRIMARY KEY NOT NULL,
  number TEXT NOT NULL,
  date TEXT NOT NULL,
  invoice_id TEXT NOT NULL,
  invoice_number TEXT NOT NULL,
  party_id TEXT,
  party_name TEXT NOT NULL DEFAULT '',
  total REAL NOT NULL,
  refund_mode TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  user_id TEXT NOT NULL DEFAULT '',
  user_name TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS return_items (
  id TEXT PRIMARY KEY NOT NULL,
  return_id TEXT NOT NULL,
  invoice_item_id TEXT NOT NULL,
  product_id TEXT,
  name TEXT NOT NULL,
  qty REAL NOT NULL,
  total REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS cash_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  opened_at TEXT NOT NULL,
  closed_at TEXT,
  opening_cash REAL NOT NULL,
  closing_cash REAL,
  expected_cash REAL,
  difference REAL,
  note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL,
  user_id TEXT NOT NULL DEFAULT '',
  user_name TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS cash_moves (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  kind TEXT NOT NULL,
  amount REAL NOT NULL,
  direction TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  ref_id TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(date);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_ledger_party ON ledger(party_id);
`;

type Db = SQLite.SQLiteDatabase;
let dbPromise: Promise<Db> | null = null;

export function getDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      try {
        const db = await SQLite.openDatabaseAsync('citystar.db');
        try {
          await db.execAsync('PRAGMA journal_mode = WAL;');
        } catch {
          // Web storage does not use WAL.
        }
        await db.execAsync(SCHEMA);
        return db;
      } catch (error) {
        dbPromise = null;
        throw error;
      }
    })();
  }
  return dbPromise;
}

export async function initDb() {
  await getDb();
}

async function putSetting(db: Db, key: string, value: string) {
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    value,
  );
}

function settingNumber(map: Record<string, string>, key: string) {
  const n = Number(map[key] ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export async function getSettings(): Promise<Settings> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM settings');
  const map = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  const language: Lang = map.language === 'gu' ? 'gu' : 'en';
  const paperWidth: PaperWidth = map.paperWidth === '80' ? '80' : '58';
  return {
    shopName: map.shopName ?? 'City Star',
    shopNameGu: map.shopNameGu ?? '',
    phone: map.phone ?? '',
    address: map.address ?? '',
    gstin: map.gstin ?? '',
    language,
    taxInclusive: map.taxInclusive !== '0',
    paperWidth,
    printerAddress: map.printerAddress ?? '',
    printerName: map.printerName ?? '',
    invoicePrefix: map.invoicePrefix || 'CS',
    invoiceSeq: settingNumber(map, 'invoiceSeq'),
    purchaseSeq: settingNumber(map, 'purchaseSeq'),
    returnSeq: settingNumber(map, 'returnSeq'),
    setupDone: map.setupDone === '1',
    currentUserId: map.currentUserId ?? '',
  };
}

export async function saveSettings(patch: Partial<Settings>) {
  const db = await getDb();
  for (const [key, value] of Object.entries(patch)) {
    const stored = typeof value === 'boolean' ? (value ? '1' : '0') : String(value ?? '');
    await putSetting(db, key, stored);
  }
}

export function hashPin(pin: string) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `city-star:${pin}`);
}

function mapUser(row: { id: string; name: string; role: string; active: number; created_at: string }): User {
  return {
    id: row.id,
    name: row.name,
    role: row.role as Role,
    active: row.active === 1,
    createdAt: row.created_at,
  };
}

export async function listUsers() {
  const db = await getDb();
  const rows = await db.getAllAsync<{ id: string; name: string; role: string; active: number; created_at: string }>(
    'SELECT id, name, role, active, created_at FROM users ORDER BY created_at ASC',
  );
  return rows.map(mapUser);
}

export async function getUser(id: string) {
  if (!id) return null;
  const db = await getDb();
  const row = await db.getFirstAsync<{ id: string; name: string; role: string; active: number; created_at: string }>(
    'SELECT id, name, role, active, created_at FROM users WHERE id = ?',
    id,
  );
  return row ? mapUser(row) : null;
}

export async function verifyPin(userId: string, pin: string) {
  const db = await getDb();
  const hash = await hashPin(pin);
  const row = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM users WHERE id = ? AND pin_hash = ? AND active = 1',
    userId,
    hash,
  );
  return Boolean(row);
}

async function pinTaken(pin: string, exceptId?: string) {
  const db = await getDb();
  const hash = await hashPin(pin);
  const row = await db.getFirstAsync<{ id: string }>('SELECT id FROM users WHERE pin_hash = ? AND active = 1', hash);
  return Boolean(row && row.id !== exceptId);
}

export async function saveUser(input: { id?: string; name: string; role: Role; pin?: string; active: boolean }) {
  const name = input.name.trim();
  if (!name) fail('name_required');
  const pin = input.pin?.trim() ?? '';
  if (pin && !/^\d{4,6}$/.test(pin)) fail('pin_rule');
  if (!input.id && !pin) fail('pin_rule');
  if (pin && (await pinTaken(pin, input.id))) fail('pin_used');

  const db = await getDb();
  const users = await listUsers();
  const activeAdmins = users.filter((user) => user.role === 'admin' && user.active);
  if (input.id) {
    const current = users.find((user) => user.id === input.id);
    const removesAdmin = current?.role === 'admin' && current.active && (input.role !== 'admin' || !input.active);
    if (removesAdmin && activeAdmins.length <= 1) fail('last_admin');
  }

  if (input.id) {
    if (pin) {
      const hash = await hashPin(pin);
      await db.runAsync('UPDATE users SET name = ?, role = ?, active = ?, pin_hash = ? WHERE id = ?', name, input.role, input.active ? 1 : 0, hash, input.id);
    } else {
      await db.runAsync('UPDATE users SET name = ?, role = ?, active = ? WHERE id = ?', name, input.role, input.active ? 1 : 0, input.id);
    }
    return input.id;
  }

  const id = uid('usr');
  const hash = await hashPin(pin);
  await db.runAsync(
    'INSERT INTO users (id, name, pin_hash, role, active, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    id,
    name,
    hash,
    input.role,
    input.active ? 1 : 0,
    nowIso(),
  );
  return id;
}

function mapProduct(row: {
  id: string;
  name: string;
  name_gu: string;
  sku: string;
  category: string;
  unit: string;
  sale_price: number;
  purchase_price: number;
  gst_rate: number;
  stock: number;
  low_stock: number;
  active: number;
}): Product {
  return {
    id: row.id,
    name: row.name,
    nameGu: row.name_gu,
    sku: row.sku,
    category: row.category,
    unit: row.unit,
    salePrice: row.sale_price,
    purchasePrice: row.purchase_price,
    gstRate: row.gst_rate,
    stock: row.stock,
    lowStock: row.low_stock,
    active: row.active === 1,
  };
}

export async function listProducts(includeInactive = false) {
  const db = await getDb();
  const rows = await db.getAllAsync<Parameters<typeof mapProduct>[0]>(
    `SELECT * FROM products ${includeInactive ? '' : 'WHERE active = 1'} ORDER BY name COLLATE NOCASE`,
  );
  return rows.map(mapProduct);
}

export async function getProduct(id: string) {
  const db = await getDb();
  const row = await db.getFirstAsync<Parameters<typeof mapProduct>[0]>('SELECT * FROM products WHERE id = ?', id);
  return row ? mapProduct(row) : null;
}

export async function saveProduct(input: Omit<Product, 'id' | 'active'> & { id?: string; active?: boolean }) {
  const name = input.name.trim();
  if (!name) fail('name_required');
  if (input.salePrice < 0 || input.purchasePrice < 0) fail('invalid_amount');
  const db = await getDb();
  const active = input.active === false ? 0 : 1;
  if (input.id) {
    await db.runAsync(
      `UPDATE products SET name = ?, name_gu = ?, sku = ?, category = ?, unit = ?, sale_price = ?, purchase_price = ?, gst_rate = ?, stock = ?, low_stock = ?, active = ? WHERE id = ?`,
      name,
      input.nameGu.trim(),
      input.sku.trim(),
      input.category.trim(),
      input.unit || 'pcs',
      input.salePrice,
      input.purchasePrice,
      input.gstRate,
      input.stock,
      input.lowStock,
      active,
      input.id,
    );
    return input.id;
  }
  const id = uid('prd');
  await db.runAsync(
    `INSERT INTO products (id, name, name_gu, sku, category, unit, sale_price, purchase_price, gst_rate, stock, low_stock, active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    id,
    name,
    input.nameGu.trim(),
    input.sku.trim(),
    input.category.trim(),
    input.unit || 'pcs',
    input.salePrice,
    input.purchasePrice,
    input.gstRate,
    input.stock,
    input.lowStock,
    nowIso(),
  );
  return id;
}

function mapParty(row: {
  id: string;
  kind: string;
  name: string;
  phone: string;
  address: string;
  gstin: string;
  balance: number;
  created_at: string;
}): Party {
  return {
    id: row.id,
    kind: row.kind as PartyKind,
    name: row.name,
    phone: row.phone,
    address: row.address,
    gstin: row.gstin,
    balance: row.balance,
    createdAt: row.created_at,
  };
}

export async function listParties(kind?: PartyKind) {
  const db = await getDb();
  const rows = kind
    ? await db.getAllAsync<Parameters<typeof mapParty>[0]>('SELECT * FROM parties WHERE kind = ? ORDER BY name COLLATE NOCASE', kind)
    : await db.getAllAsync<Parameters<typeof mapParty>[0]>('SELECT * FROM parties ORDER BY name COLLATE NOCASE');
  return rows.map(mapParty);
}

export async function getParty(id: string) {
  const db = await getDb();
  const row = await db.getFirstAsync<Parameters<typeof mapParty>[0]>('SELECT * FROM parties WHERE id = ?', id);
  return row ? mapParty(row) : null;
}

async function addLedger(
  db: Db,
  partyId: string,
  kind: string,
  debit: number,
  credit: number,
  refId: string,
  note: string,
) {
  await db.runAsync(
    'INSERT INTO ledger (id, party_id, date, kind, ref_id, note, debit, credit, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    uid('led'),
    partyId,
    todayKey(),
    kind,
    refId,
    note,
    round2(debit),
    round2(credit),
    nowIso(),
  );
}

export async function saveParty(input: {
  id?: string;
  kind: PartyKind;
  name: string;
  phone: string;
  address: string;
  gstin: string;
  opening?: number;
}) {
  const name = input.name.trim();
  if (!name) fail('name_required');
  const phone = input.phone.trim();
  if (phone && !/^\d{10,13}$/.test(phone)) fail('phone_invalid');
  const db = await getDb();
  if (input.id) {
    await db.runAsync(
      'UPDATE parties SET kind = ?, name = ?, phone = ?, address = ?, gstin = ? WHERE id = ?',
      input.kind,
      name,
      phone,
      input.address.trim(),
      input.gstin.trim().toUpperCase(),
      input.id,
    );
    return input.id;
  }
  const id = uid('pty');
  const opening = round2(input.opening ?? 0);
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'INSERT INTO parties (id, kind, name, phone, address, gstin, balance, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      id,
      input.kind,
      name,
      phone,
      input.address.trim(),
      input.gstin.trim().toUpperCase(),
      opening,
      nowIso(),
    );
    if (opening !== 0) {
      const debit = input.kind === 'customer' ? Math.max(opening, 0) : Math.max(-opening, 0);
      const credit = input.kind === 'customer' ? Math.max(-opening, 0) : Math.max(opening, 0);
      await addLedger(db, id, 'opening', debit, credit, '', '');
    }
  });
  return id;
}

export async function deleteParty(id: string) {
  const db = await getDb();
  const party = await getParty(id);
  if (!party) fail('party_missing');
  if (Math.abs(party.balance) > 0.001) fail('has_balance');
  const ledger = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM ledger WHERE party_id = ?', id);
  if ((ledger?.count ?? 0) > 0) fail('has_history');
  const bills = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM invoices WHERE party_id = ?', id);
  if ((bills?.count ?? 0) > 0) fail('has_history');
  await db.runAsync('DELETE FROM parties WHERE id = ?', id);
}

export async function listLedger(partyId: string) {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: string;
    party_id: string;
    date: string;
    kind: string;
    ref_id: string;
    note: string;
    debit: number;
    credit: number;
    created_at: string;
  }>('SELECT * FROM ledger WHERE party_id = ? ORDER BY created_at DESC', partyId);
  return rows.map(
    (row): LedgerEntry => ({
      id: row.id,
      partyId: row.party_id,
      date: row.date,
      kind: row.kind,
      refId: row.ref_id,
      note: row.note,
      debit: row.debit,
      credit: row.credit,
      createdAt: row.created_at,
    }),
  );
}

function mapInvoice(row: {
  id: string;
  number: string;
  date: string;
  party_id: string | null;
  party_name: string;
  party_phone: string;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paid: number;
  due: number;
  payment_mode: string;
  status: string;
  note: string;
  user_id: string;
  user_name: string;
  created_at: string;
}): Invoice {
  return {
    id: row.id,
    number: row.number,
    date: row.date,
    partyId: row.party_id,
    partyName: row.party_name,
    partyPhone: row.party_phone,
    subtotal: row.subtotal,
    tax: row.tax,
    discount: row.discount,
    total: row.total,
    paid: row.paid,
    due: row.due,
    paymentMode: row.payment_mode as PayMode,
    status: row.status as BillStatus,
    note: row.note,
    userId: row.user_id,
    userName: row.user_name,
    createdAt: row.created_at,
  };
}

function mapItem(row: {
  id: string;
  invoice_id: string;
  product_id: string | null;
  name: string;
  name_gu: string;
  unit: string;
  qty: number;
  returned_qty: number;
  rate: number;
  gst_rate: number;
  taxable: number;
  tax: number;
  total: number;
  purchase_price: number;
}): InvoiceItem {
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    productId: row.product_id,
    name: row.name,
    nameGu: row.name_gu,
    unit: row.unit,
    qty: row.qty,
    returnedQty: row.returned_qty,
    rate: row.rate,
    gstRate: row.gst_rate,
    taxable: row.taxable,
    tax: row.tax,
    total: row.total,
    purchasePrice: row.purchase_price,
  };
}

export async function listInvoices(search = '', onlyDue = false) {
  const db = await getDb();
  const like = `%${search.trim()}%`;
  const rows = await db.getAllAsync<Parameters<typeof mapInvoice>[0]>(
    `SELECT * FROM invoices
     WHERE (? = '' OR number LIKE ? OR party_name LIKE ? OR party_phone LIKE ?)
       AND (? = 0 OR due > 0.001)
     ORDER BY created_at DESC
     LIMIT 200`,
    search.trim(),
    like,
    like,
    like,
    onlyDue ? 1 : 0,
  );
  return rows.map(mapInvoice);
}

export async function getInvoice(id: string) {
  const db = await getDb();
  const row = await db.getFirstAsync<Parameters<typeof mapInvoice>[0]>('SELECT * FROM invoices WHERE id = ?', id);
  if (!row) return null;
  const items = await db.getAllAsync<Parameters<typeof mapItem>[0]>(
    'SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY rowid',
    id,
  );
  return { invoice: mapInvoice(row), items: items.map(mapItem) };
}

async function takeNumber(db: Db, seqKey: string, prefix: string) {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', seqKey);
  const seq = Number(row?.value ?? 0) + 1;
  await putSetting(db, seqKey, String(seq));
  return `${prefix}${String(seq).padStart(4, '0')}`;
}

async function moveCash(db: Db, kind: string, direction: 'in' | 'out', amount: number, refId: string, note: string) {
  const value = round2(amount);
  if (value <= 0) return;
  const session = await db.getFirstAsync<{ id: string }>("SELECT id FROM cash_sessions WHERE status = 'open' LIMIT 1");
  if (!session) return;
  await db.runAsync(
    'INSERT INTO cash_moves (id, session_id, created_at, kind, amount, direction, note, ref_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    uid('mv'),
    session.id,
    nowIso(),
    kind,
    value,
    direction,
    note,
    refId,
  );
}

export async function createSale(input: {
  partyId: string | null;
  lines: CartInput[];
  discount: number;
  paymentMode: PayMode;
  paid: number;
  received: number;
  note: string;
  user: Actor;
  taxInclusive: boolean;
}) {
  const lines = input.lines.filter((line) => line.qty > 0);
  if (!lines.length) fail('empty_cart');
  if (lines.some((line) => line.rate < 0)) fail('invalid_amount');
  const bill = computeBill(lines, input.discount, input.taxInclusive);
  if (bill.total < 0) fail('invalid_amount');

  let paid = bill.total;
  let due = 0;
  if (input.paymentMode === 'credit') {
    if (!input.partyId) fail('customer_required');
    paid = round2(Math.min(Math.max(0, input.paid), bill.total));
    due = round2(bill.total - paid);
  } else if (input.paymentMode === 'cash') {
    if (round2(input.received) + 0.001 < bill.total) fail('amount_short');
  }

  const db = await getDb();
  const party = input.partyId ? await getParty(input.partyId) : null;
  const id = uid('inv');
  const status: BillStatus = due <= 0.001 ? 'paid' : paid > 0 ? 'partial' : 'unpaid';

  await db.withTransactionAsync(async () => {
    const settings = await getSettings();
    const number = await takeNumber(db, 'invoiceSeq', settings.invoicePrefix || 'CS');
    await db.runAsync(
      `INSERT INTO invoices (
        id, number, date, party_id, party_name, party_phone, subtotal, tax, discount, total, paid, due,
        payment_mode, status, note, user_id, user_name, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      number,
      todayKey(),
      party?.id ?? null,
      party?.name ?? '',
      party?.phone ?? '',
      bill.subtotal,
      bill.tax,
      bill.discount,
      bill.total,
      paid,
      due,
      input.paymentMode,
      status,
      input.note.trim(),
      input.user.id,
      input.user.name,
      nowIso(),
    );
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const priced = bill.items[index];
      if (!line || !priced) continue;
      await db.runAsync(
        `INSERT INTO invoice_items (
          id, invoice_id, product_id, name, name_gu, unit, qty, returned_qty, rate, gst_rate, taxable, tax, total, purchase_price
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)`,
        uid('iit'),
        id,
        line.productId,
        line.name,
        line.nameGu,
        line.unit || 'pcs',
        round3(line.qty),
        line.rate,
        line.gstRate,
        priced.taxable,
        priced.tax,
        priced.total,
        line.purchasePrice,
      );
      if (line.productId) {
        await db.runAsync('UPDATE products SET stock = stock - ? WHERE id = ?', round3(line.qty), line.productId);
      }
    }
    if (party && due > 0) {
      await db.runAsync('UPDATE parties SET balance = balance + ? WHERE id = ?', due, party.id);
      await addLedger(db, party.id, 'sale', due, 0, id, number);
    }
    const cashIn = input.paymentMode === 'cash' ? bill.total : input.paymentMode === 'credit' ? paid : 0;
    await moveCash(db, 'sale', 'in', cashIn, id, number);
  });
  return id;
}

export async function receiveOnInvoice(invoiceId: string, amount: number, mode: Exclude<PayMode, 'credit'>, user: Actor) {
  const value = round2(amount);
  if (value <= 0) fail('invalid_amount');
  const found = await getInvoice(invoiceId);
  if (!found) fail('invoice_missing');
  if (value > found.invoice.due + 0.001) fail('amount_high');
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    const due = round2(found.invoice.due - value);
    const paid = round2(found.invoice.paid + value);
    const status: BillStatus = found.invoice.status === 'returned' ? 'returned' : due <= 0.001 ? 'paid' : 'partial';
    await db.runAsync('UPDATE invoices SET due = ?, paid = ?, status = ? WHERE id = ?', due, paid, status, invoiceId);
    if (found.invoice.partyId) {
      await db.runAsync('UPDATE parties SET balance = balance - ? WHERE id = ?', value, found.invoice.partyId);
      await addLedger(db, found.invoice.partyId, 'payment_in', 0, value, invoiceId, found.invoice.number);
    }
    if (mode === 'cash') await moveCash(db, 'sale', 'in', value, invoiceId, found.invoice.number);
  });
}

async function allocateDocuments(db: Db, table: 'invoices' | 'purchases', partyId: string, amount: number) {
  let left = round2(amount);
  const rows = await db.getAllAsync<{ id: string; due: number; paid: number }>(
    `SELECT id, due, paid FROM ${table} WHERE party_id = ? AND due > 0.001 AND status != 'returned' ORDER BY date ASC, created_at ASC`,
    partyId,
  );
  for (const row of rows) {
    if (left <= 0) break;
    const cut = round2(Math.min(row.due, left));
    const due = round2(row.due - cut);
    const paid = round2(row.paid + cut);
    const status = due <= 0.001 ? 'paid' : 'partial';
    await db.runAsync(`UPDATE ${table} SET due = ?, paid = ?, status = ? WHERE id = ?`, due, paid, status, row.id);
    left = round2(left - cut);
  }
  return left;
}

export async function receivePartyPayment(partyId: string, amount: number, mode: Exclude<PayMode, 'credit'>, user: Actor) {
  const value = round2(amount);
  if (value <= 0) fail('invalid_amount');
  const party = await getParty(partyId);
  if (!party) fail('party_missing');
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    if (party.kind === 'customer') await allocateDocuments(db, 'invoices', partyId, value);
    await db.runAsync('UPDATE parties SET balance = balance - ? WHERE id = ?', value, partyId);
    await addLedger(db, partyId, 'payment_in', 0, value, '', user.name);
    if (mode === 'cash') await moveCash(db, 'in', 'in', value, partyId, party.name);
  });
}

function mapPurchase(row: {
  id: string;
  number: string;
  date: string;
  party_id: string | null;
  party_name: string;
  subtotal: number;
  tax: number;
  total: number;
  paid: number;
  due: number;
  payment_mode: string;
  status: string;
  note: string;
  user_id: string;
  user_name: string;
  created_at: string;
}): Purchase {
  return {
    id: row.id,
    number: row.number,
    date: row.date,
    partyId: row.party_id,
    partyName: row.party_name,
    subtotal: row.subtotal,
    tax: row.tax,
    total: row.total,
    paid: row.paid,
    due: row.due,
    paymentMode: row.payment_mode as PayMode,
    note: row.note,
    userId: row.user_id,
    userName: row.user_name,
    createdAt: row.created_at,
  };
}

export async function listPurchases() {
  const db = await getDb();
  const rows = await db.getAllAsync<Parameters<typeof mapPurchase>[0]>('SELECT * FROM purchases ORDER BY created_at DESC LIMIT 200');
  return rows.map(mapPurchase);
}

export async function getPurchase(id: string) {
  const db = await getDb();
  const row = await db.getFirstAsync<Parameters<typeof mapPurchase>[0]>('SELECT * FROM purchases WHERE id = ?', id);
  if (!row) return null;
  const items = await db.getAllAsync<{
    id: string;
    purchase_id: string;
    product_id: string | null;
    name: string;
    name_gu: string;
    unit: string;
    qty: number;
    rate: number;
    gst_rate: number;
    total: number;
  }>('SELECT * FROM purchase_items WHERE purchase_id = ? ORDER BY rowid', id);
  const mapped: PurchaseItem[] = items.map((item) => ({
    id: item.id,
    purchaseId: item.purchase_id,
    productId: item.product_id,
    name: item.name,
    nameGu: item.name_gu,
    unit: item.unit,
    qty: item.qty,
    rate: item.rate,
    gstRate: item.gst_rate,
    total: item.total,
  }));
  return { purchase: mapPurchase(row), items: mapped };
}

export async function createPurchase(input: {
  partyId: string | null;
  lines: { productId: string; qty: number; rate: number }[];
  paymentMode: PayMode;
  paid: number;
  note: string;
  user: Actor;
  taxInclusive: boolean;
}) {
  const lines = input.lines.filter((line) => line.qty > 0);
  if (!lines.length) fail('at_least_one');
  const db = await getDb();
  const products: { line: (typeof lines)[number]; product: Product }[] = [];
  for (const line of lines) {
    const product = await getProduct(line.productId);
    if (!product) fail('product_missing');
    products.push({ line, product });
  }
  const bill = computeBill(
    products.map(({ line, product }) => ({ qty: line.qty, rate: line.rate, gstRate: product.gstRate })),
    0,
    input.taxInclusive,
  );
  let paid = bill.total;
  let due = 0;
  if (input.paymentMode === 'credit') {
    if (!input.partyId) fail('supplier_required');
    paid = round2(Math.min(Math.max(0, input.paid), bill.total));
    due = round2(bill.total - paid);
  }
  const party = input.partyId ? await getParty(input.partyId) : null;
  const id = uid('pur');
  const status: BillStatus = due <= 0.001 ? 'paid' : paid > 0 ? 'partial' : 'unpaid';
  await db.withTransactionAsync(async () => {
    const number = await takeNumber(db, 'purchaseSeq', 'PB');
    await db.runAsync(
      `INSERT INTO purchases (
        id, number, date, party_id, party_name, subtotal, tax, total, paid, due, payment_mode, status, note, user_id, user_name, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      number,
      todayKey(),
      party?.id ?? null,
      party?.name ?? '',
      bill.subtotal,
      bill.tax,
      bill.total,
      paid,
      due,
      input.paymentMode,
      status,
      input.note.trim(),
      input.user.id,
      input.user.name,
      nowIso(),
    );
    for (let index = 0; index < products.length; index += 1) {
      const entry = products[index];
      const priced = bill.items[index];
      if (!entry || !priced) continue;
      await db.runAsync(
        `INSERT INTO purchase_items (id, purchase_id, product_id, name, name_gu, unit, qty, rate, gst_rate, total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        uid('pit'),
        id,
        entry.product.id,
        entry.product.name,
        entry.product.nameGu,
        entry.product.unit,
        round3(entry.line.qty),
        entry.line.rate,
        entry.product.gstRate,
        priced.total,
      );
      await db.runAsync(
        'UPDATE products SET stock = stock + ?, purchase_price = ? WHERE id = ?',
        round3(entry.line.qty),
        entry.line.rate,
        entry.product.id,
      );
    }
    if (party && due > 0) {
      await db.runAsync('UPDATE parties SET balance = balance + ? WHERE id = ?', due, party.id);
      await addLedger(db, party.id, 'purchase', 0, due, id, number);
    }
    const cashOut = input.paymentMode === 'cash' ? bill.total : input.paymentMode === 'credit' ? paid : 0;
    await moveCash(db, 'purchase', 'out', cashOut, id, number);
  });
  return id;
}

export async function paySupplier(partyId: string, amount: number, mode: Exclude<PayMode, 'credit'>, user: Actor) {
  const value = round2(amount);
  if (value <= 0) fail('invalid_amount');
  const party = await getParty(partyId);
  if (!party) fail('party_missing');
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await allocateDocuments(db, 'purchases', partyId, value);
    await db.runAsync('UPDATE parties SET balance = balance - ? WHERE id = ?', value, partyId);
    await addLedger(db, partyId, 'payment_out', value, 0, '', user.name);
    if (mode === 'cash') await moveCash(db, 'out', 'out', value, partyId, party.name);
  });
}

function mapExpense(row: {
  id: string;
  date: string;
  category: string;
  amount: number;
  payment_mode: string;
  note: string;
  user_id: string;
  user_name: string;
  created_at: string;
}): Expense {
  return {
    id: row.id,
    date: row.date,
    category: row.category,
    amount: row.amount,
    paymentMode: row.payment_mode as Expense['paymentMode'],
    note: row.note,
    userId: row.user_id,
    userName: row.user_name,
    createdAt: row.created_at,
  };
}

export async function listExpenses() {
  const db = await getDb();
  const rows = await db.getAllAsync<Parameters<typeof mapExpense>[0]>('SELECT * FROM expenses ORDER BY created_at DESC LIMIT 200');
  return rows.map(mapExpense);
}

export async function createExpense(input: {
  category: string;
  amount: number;
  paymentMode: Expense['paymentMode'];
  note: string;
  user: Actor;
}) {
  const amount = round2(input.amount);
  if (amount <= 0) fail('invalid_amount');
  if (!input.category) fail('name_required');
  const db = await getDb();
  const id = uid('exp');
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'INSERT INTO expenses (id, date, category, amount, payment_mode, note, user_id, user_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      id,
      todayKey(),
      input.category,
      amount,
      input.paymentMode,
      input.note.trim(),
      input.user.id,
      input.user.name,
      nowIso(),
    );
    if (input.paymentMode === 'cash') await moveCash(db, 'expense', 'out', amount, id, input.category);
  });
  return id;
}

function mapReturn(row: {
  id: string;
  number: string;
  date: string;
  invoice_id: string;
  invoice_number: string;
  party_id: string | null;
  party_name: string;
  total: number;
  refund_mode: string;
  note: string;
  user_id: string;
  user_name: string;
  created_at: string;
}): SaleReturn {
  return {
    id: row.id,
    number: row.number,
    date: row.date,
    invoiceId: row.invoice_id,
    invoiceNumber: row.invoice_number,
    partyId: row.party_id,
    partyName: row.party_name,
    total: row.total,
    refundMode: row.refund_mode as SaleReturn['refundMode'],
    note: row.note,
    userId: row.user_id,
    userName: row.user_name,
    createdAt: row.created_at,
  };
}

export async function listReturns() {
  const db = await getDb();
  const rows = await db.getAllAsync<Parameters<typeof mapReturn>[0]>('SELECT * FROM returns ORDER BY created_at DESC LIMIT 200');
  return rows.map(mapReturn);
}

export async function returnsForInvoice(invoiceId: string) {
  const db = await getDb();
  const rows = await db.getAllAsync<Parameters<typeof mapReturn>[0]>(
    'SELECT * FROM returns WHERE invoice_id = ? ORDER BY created_at DESC',
    invoiceId,
  );
  return rows.map(mapReturn);
}

export async function listReturnableInvoices(search = '') {
  const db = await getDb();
  const like = `%${search.trim()}%`;
  const rows = await db.getAllAsync<Parameters<typeof mapInvoice>[0]>(
    `SELECT * FROM invoices i
     WHERE EXISTS (SELECT 1 FROM invoice_items ii WHERE ii.invoice_id = i.id AND ii.returned_qty + 0.0001 < ii.qty)
       AND (? = '' OR i.number LIKE ? OR i.party_name LIKE ?)
     ORDER BY i.created_at DESC
     LIMIT 50`,
    search.trim(),
    like,
    like,
  );
  return rows.map(mapInvoice);
}

export async function createReturn(input: {
  invoiceId: string;
  lines: { invoiceItemId: string; qty: number }[];
  refundMode: 'cash' | 'upi' | 'credit';
  note: string;
  user: Actor;
}) {
  const found = await getInvoice(input.invoiceId);
  if (!found) fail('invoice_missing');
  const chosen = input.lines
    .map((line) => {
      const item = found.items.find((entry) => entry.id === line.invoiceItemId);
      return item ? { item, qty: round3(line.qty) } : null;
    })
    .filter((line): line is { item: InvoiceItem; qty: number } => Boolean(line && line.qty > 0));
  if (!chosen.length) fail('pick_one');
  let returnTotal = 0;
  for (const line of chosen) {
    const left = round3(line.item.qty - line.item.returnedQty);
    if (line.qty > left + 0.0001) fail('cannot_exceed');
    const unit = line.item.qty === 0 ? 0 : line.item.total / line.item.qty;
    returnTotal += unit * line.qty;
  }
  returnTotal = round2(returnTotal);
  if (returnTotal <= 0) fail('nothing_to_return');
  const split = splitRefund(found.invoice.due, returnTotal, input.refundMode);
  const db = await getDb();
  const id = uid('ret');
  await db.withTransactionAsync(async () => {
    const number = await takeNumber(db, 'returnSeq', 'RT');
    await db.runAsync(
      `INSERT INTO returns (
        id, number, date, invoice_id, invoice_number, party_id, party_name, total, refund_mode, note, user_id, user_name, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      number,
      todayKey(),
      found.invoice.id,
      found.invoice.number,
      found.invoice.partyId,
      found.invoice.partyName,
      returnTotal,
      input.refundMode,
      input.note.trim(),
      input.user.id,
      input.user.name,
      nowIso(),
    );
    for (const line of chosen) {
      const unit = line.item.qty === 0 ? 0 : line.item.total / line.item.qty;
      await db.runAsync(
        'INSERT INTO return_items (id, return_id, invoice_item_id, product_id, name, qty, total) VALUES (?, ?, ?, ?, ?, ?, ?)',
        uid('rit'),
        id,
        line.item.id,
        line.item.productId,
        line.item.name,
        line.qty,
        round2(unit * line.qty),
      );
      await db.runAsync('UPDATE invoice_items SET returned_qty = returned_qty + ? WHERE id = ?', line.qty, line.item.id);
      if (line.item.productId) {
        await db.runAsync('UPDATE products SET stock = stock + ? WHERE id = ?', line.qty, line.item.productId);
      }
    }
    const due = round2(Math.max(0, found.invoice.due - split.dueCut));
    const refreshed = await db.getAllAsync<{ qty: number; returned_qty: number }>(
      'SELECT qty, returned_qty FROM invoice_items WHERE invoice_id = ?',
      found.invoice.id,
    );
    const fully = refreshed.every((item) => item.returned_qty + 0.0001 >= item.qty);
    const status: BillStatus = fully ? 'returned' : due <= 0.001 ? 'paid' : found.invoice.paid > 0 ? 'partial' : 'unpaid';
    await db.runAsync('UPDATE invoices SET due = ?, status = ? WHERE id = ?', due, status, found.invoice.id);
    if (found.invoice.partyId && split.balanceCut > 0) {
      await db.runAsync('UPDATE parties SET balance = balance - ? WHERE id = ?', split.balanceCut, found.invoice.partyId);
      await addLedger(db, found.invoice.partyId, 'return', 0, split.balanceCut, id, number);
    }
    await moveCash(db, 'return', 'out', split.cashOut, id, number);
  });
  return id;
}

function mapSession(row: {
  id: string;
  opened_at: string;
  closed_at: string | null;
  opening_cash: number;
  closing_cash: number | null;
  expected_cash: number | null;
  difference: number | null;
  note: string;
  status: string;
  user_id: string;
  user_name: string;
}): CashSession {
  return {
    id: row.id,
    openedAt: row.opened_at,
    closedAt: row.closed_at,
    openingCash: row.opening_cash,
    closingCash: row.closing_cash,
    expectedCash: row.expected_cash,
    difference: row.difference,
    note: row.note,
    status: row.status as CashSession['status'],
    userId: row.user_id,
    userName: row.user_name,
  };
}

function mapMove(row: {
  id: string;
  session_id: string;
  created_at: string;
  kind: string;
  amount: number;
  direction: string;
  note: string;
  ref_id: string;
}): CashMove {
  return {
    id: row.id,
    sessionId: row.session_id,
    createdAt: row.created_at,
    kind: row.kind,
    amount: row.amount,
    direction: row.direction === 'out' ? 'out' : 'in',
    note: row.note,
    refId: row.ref_id,
  };
}

async function expectedCash(db: Db, sessionId: string, opening: number) {
  const row = await db.getFirstAsync<{ cash_in: number; cash_out: number }>(
    `SELECT
       COALESCE(SUM(CASE WHEN direction = 'in' THEN amount ELSE 0 END), 0) AS cash_in,
       COALESCE(SUM(CASE WHEN direction = 'out' THEN amount ELSE 0 END), 0) AS cash_out
     FROM cash_moves WHERE session_id = ?`,
    sessionId,
  );
  return round2(opening + (row?.cash_in ?? 0) - (row?.cash_out ?? 0));
}

export async function drawerState() {
  const db = await getDb();
  const open = await db.getFirstAsync<Parameters<typeof mapSession>[0]>("SELECT * FROM cash_sessions WHERE status = 'open' LIMIT 1");
  const lastRow = await db.getFirstAsync<Parameters<typeof mapSession>[0]>(
    "SELECT * FROM cash_sessions WHERE status = 'closed' ORDER BY closed_at DESC LIMIT 1",
  );
  if (!open) {
    return { session: null, moves: [] as CashMove[], expected: 0, last: lastRow ? mapSession(lastRow) : null };
  }
  const session = mapSession(open);
  const moves = (
    await db.getAllAsync<Parameters<typeof mapMove>[0]>('SELECT * FROM cash_moves WHERE session_id = ? ORDER BY created_at DESC', session.id)
  ).map(mapMove);
  const expected = await expectedCash(db, session.id, session.openingCash);
  return { session, moves, expected, last: lastRow ? mapSession(lastRow) : null };
}

export async function openDrawer(opening: number, note: string, user: Actor) {
  if (!Number.isFinite(opening) || opening < 0) fail('opening_required');
  const db = await getDb();
  const existing = await db.getFirstAsync<{ id: string }>("SELECT id FROM cash_sessions WHERE status = 'open' LIMIT 1");
  if (existing) fail('already_open');
  const id = uid('drw');
  await db.runAsync(
    `INSERT INTO cash_sessions (id, opened_at, opening_cash, note, status, user_id, user_name)
     VALUES (?, ?, ?, ?, 'open', ?, ?)`,
    id,
    nowIso(),
    round2(opening),
    note.trim(),
    user.id,
    user.name,
  );
  return id;
}

export async function closeDrawer(counted: number, note: string) {
  if (!Number.isFinite(counted) || counted < 0) fail('counted_required');
  const db = await getDb();
  const open = await db.getFirstAsync<Parameters<typeof mapSession>[0]>("SELECT * FROM cash_sessions WHERE status = 'open' LIMIT 1");
  if (!open) fail('must_open_drawer');
  const expected = await expectedCash(db, open.id, open.opening_cash);
  const difference = round2(counted - expected);
  await db.runAsync(
    `UPDATE cash_sessions SET status = 'closed', closed_at = ?, closing_cash = ?, expected_cash = ?, difference = ?, note = ? WHERE id = ?`,
    nowIso(),
    round2(counted),
    expected,
    difference,
    note.trim() || open.note,
    open.id,
  );
}

export async function recordCash(direction: 'in' | 'out', amount: number, note: string) {
  const value = round2(amount);
  if (value <= 0) fail('invalid_amount');
  const db = await getDb();
  const open = await db.getFirstAsync<{ id: string }>("SELECT id FROM cash_sessions WHERE status = 'open' LIMIT 1");
  if (!open) fail('must_open_drawer');
  await moveCash(db, direction === 'in' ? 'in' : 'out', direction, value, '', note.trim());
}

async function sumPair(db: Db, sql: string, ...params: (string | number)[]) {
  const row = await db.getFirstAsync<{ a: number; b: number }>(sql, ...params);
  return { a: row?.a ?? 0, b: row?.b ?? 0 };
}

export async function dashboard() {
  const db = await getDb();
  const day = todayKey();
  const sales = await db.getFirstAsync<{ total: number; count: number; cash: number }>(
    `SELECT COALESCE(SUM(total), 0) AS total, COUNT(*) AS count,
            COALESCE(SUM(CASE WHEN payment_mode = 'cash' THEN total WHEN payment_mode = 'credit' THEN paid ELSE 0 END), 0) AS cash
     FROM invoices WHERE date = ?`,
    day,
  );
  const returns = await db.getFirstAsync<{ total: number }>('SELECT COALESCE(SUM(total), 0) AS total FROM returns WHERE date = ?', day);
  const margin = await db.getFirstAsync<{ revenue: number; cost: number }>(
    `SELECT
       COALESCE(SUM(CASE WHEN ii.qty = 0 THEN 0 ELSE (ii.qty - ii.returned_qty) * (ii.taxable / ii.qty) END), 0) AS revenue,
       COALESCE(SUM((ii.qty - ii.returned_qty) * ii.purchase_price), 0) AS cost
     FROM invoice_items ii JOIN invoices i ON i.id = ii.invoice_id WHERE i.date = ?`,
    day,
  );
  const discount = await db.getFirstAsync<{ total: number }>('SELECT COALESCE(SUM(discount), 0) AS total FROM invoices WHERE date = ?', day);
  const expense = await db.getFirstAsync<{ total: number }>('SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE date = ?', day);
  const receivable = await db.getFirstAsync<{ total: number }>(
    "SELECT COALESCE(SUM(balance), 0) AS total FROM parties WHERE kind = 'customer' AND balance > 0",
  );
  const payable = await db.getFirstAsync<{ total: number }>(
    "SELECT COALESCE(SUM(balance), 0) AS total FROM parties WHERE kind = 'supplier' AND balance > 0",
  );
  const lowRows = await db.getAllAsync<Parameters<typeof mapProduct>[0]>(
    'SELECT * FROM products WHERE active = 1 AND stock <= low_stock ORDER BY stock ASC LIMIT 6',
  );
  const recentRows = await db.getAllAsync<Parameters<typeof mapInvoice>[0]>('SELECT * FROM invoices ORDER BY created_at DESC LIMIT 6');
  const drawer = await drawerState();
  const profit = round2((margin?.revenue ?? 0) - (margin?.cost ?? 0) - (discount?.total ?? 0) - (expense?.total ?? 0));
  return {
    saleTotal: sales?.total ?? 0,
    billCount: sales?.count ?? 0,
    cashCollected: sales?.cash ?? 0,
    returnTotal: returns?.total ?? 0,
    profit,
    receivable: receivable?.total ?? 0,
    payable: payable?.total ?? 0,
    expenseTotal: expense?.total ?? 0,
    lowStock: lowRows.map(mapProduct),
    recent: recentRows.map(mapInvoice),
    drawerOpen: Boolean(drawer.session),
    drawerExpected: drawer.expected,
  };
}

export async function report(preset: 'today' | 'week' | 'month') {
  const db = await getDb();
  const { start, end } = rangeFor(preset);
  const between = 'date >= ? AND date <= ?';
  const sales = await sumPair(db, `SELECT COALESCE(SUM(total), 0) AS a, COALESCE(SUM(tax), 0) AS b FROM invoices WHERE ${between}`, start, end);
  const purchases = await db.getFirstAsync<{ a: number }>(`SELECT COALESCE(SUM(total), 0) AS a FROM purchases WHERE ${between}`, start, end);
  const expenses = await db.getFirstAsync<{ a: number }>(`SELECT COALESCE(SUM(amount), 0) AS a FROM expenses WHERE ${between}`, start, end);
  const returns = await db.getFirstAsync<{ a: number }>(`SELECT COALESCE(SUM(total), 0) AS a FROM returns WHERE ${between}`, start, end);
  const margin = await db.getFirstAsync<{ revenue: number; cost: number }>(
    `SELECT
       COALESCE(SUM(CASE WHEN ii.qty = 0 THEN 0 ELSE (ii.qty - ii.returned_qty) * (ii.taxable / ii.qty) END), 0) AS revenue,
       COALESCE(SUM((ii.qty - ii.returned_qty) * ii.purchase_price), 0) AS cost
     FROM invoice_items ii JOIN invoices i ON i.id = ii.invoice_id WHERE i.date >= ? AND i.date <= ?`,
    start,
    end,
  );
  const discount = await db.getFirstAsync<{ a: number }>('SELECT COALESCE(SUM(discount), 0) AS a FROM invoices WHERE date >= ? AND date <= ?', start, end);
  const days = last7Days();
  const dayRows = await db.getAllAsync<{ date: string; total: number }>(
    'SELECT date, COALESCE(SUM(total), 0) AS total FROM invoices WHERE date >= ? GROUP BY date',
    days[0] ?? todayKey(),
  );
  const top = await db.getAllAsync<{ name: string; name_gu: string; qty: number; amount: number }>(
    `SELECT ii.name AS name, ii.name_gu AS name_gu,
            COALESCE(SUM(ii.qty - ii.returned_qty), 0) AS qty,
            COALESCE(SUM(CASE WHEN ii.qty = 0 THEN 0 ELSE (ii.qty - ii.returned_qty) * ii.total / ii.qty END), 0) AS amount
     FROM invoice_items ii JOIN invoices i ON i.id = ii.invoice_id
     WHERE i.date >= ? AND i.date <= ?
     GROUP BY ii.product_id, ii.name
     HAVING qty > 0
     ORDER BY amount DESC
     LIMIT 5`,
    start,
    end,
  );
  const byDay = new Map(dayRows.map((row) => [row.date, row.total]));
  return {
    start,
    end,
    sales: sales.a,
    tax: sales.b,
    purchases: purchases?.a ?? 0,
    expenses: expenses?.a ?? 0,
    returns: returns?.a ?? 0,
    profit: round2((margin?.revenue ?? 0) - (margin?.cost ?? 0) - (discount?.a ?? 0) - (expenses?.a ?? 0)),
    days: days.map((date) => ({ date, total: byDay.get(date) ?? 0 })),
    top: top.map((row) => ({ name: row.name, nameGu: row.name_gu, qty: row.qty, amount: row.amount })),
  };
}

const SAMPLE_PRODUCTS: Array<Omit<Product, 'id' | 'active'>> = [
  { name: 'Tata Tea 100g', nameGu: 'ટાટા ચા 100 ગ્રામ', sku: 'TEA100', category: 'grocery', unit: 'pcs', salePrice: 48, purchasePrice: 42, gstRate: 5, stock: 24, lowStock: 8 },
  { name: 'Sugar 1kg', nameGu: 'સાકર 1 કિલો', sku: 'SUG1', category: 'grocery', unit: 'kg', salePrice: 44, purchasePrice: 40, gstRate: 5, stock: 30, lowStock: 10 },
  { name: 'Rice 1kg', nameGu: 'ચોખા 1 કિલો', sku: 'RIC1', category: 'grocery', unit: 'kg', salePrice: 62, purchasePrice: 54, gstRate: 5, stock: 18, lowStock: 8 },
  { name: 'Wheat flour 1kg', nameGu: 'ઘઉંનો લોટ 1 કિલો', sku: 'WHT1', category: 'grocery', unit: 'kg', salePrice: 46, purchasePrice: 40, gstRate: 5, stock: 6, lowStock: 10 },
  { name: 'Sunflower oil 1L', nameGu: 'સનફ્લાવર તેલ 1 લિટર', sku: 'OIL1', category: 'grocery', unit: 'pcs', salePrice: 145, purchasePrice: 132, gstRate: 5, stock: 10, lowStock: 4 },
  { name: 'Bath soap', nameGu: 'બાથ સાબુ', sku: 'SOAP', category: 'personal', unit: 'pcs', salePrice: 35, purchasePrice: 26, gstRate: 18, stock: 40, lowStock: 10 },
  { name: 'Biscuits', nameGu: 'બિસ્કિટ', sku: 'BISC', category: 'grocery', unit: 'pcs', salePrice: 10, purchasePrice: 8, gstRate: 18, stock: 50, lowStock: 12 },
  { name: 'Milk 500ml', nameGu: 'દૂધ 500 મિલી', sku: 'MLK500', category: 'dairy', unit: 'pcs', salePrice: 28, purchasePrice: 24, gstRate: 0, stock: 3, lowStock: 6 },
  { name: 'Toor dal 1kg', nameGu: 'તુવેર દાળ 1 કિલો', sku: 'DAL1', category: 'grocery', unit: 'kg', salePrice: 150, purchasePrice: 135, gstRate: 5, stock: 8, lowStock: 6 },
  { name: 'Salt 1kg', nameGu: 'મીઠું 1 કિલો', sku: 'SALT', category: 'grocery', unit: 'pcs', salePrice: 22, purchasePrice: 18, gstRate: 5, stock: 20, lowStock: 6 },
];

async function insertSample(db: Db) {
  for (const product of SAMPLE_PRODUCTS) {
    await db.runAsync(
      `INSERT INTO products (id, name, name_gu, sku, category, unit, sale_price, purchase_price, gst_rate, stock, low_stock, active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      uid('prd'),
      product.name,
      product.nameGu,
      product.sku,
      product.category,
      product.unit,
      product.salePrice,
      product.purchasePrice,
      product.gstRate,
      product.stock,
      product.lowStock,
      nowIso(),
    );
  }
  const customerId = uid('pty');
  const supplierId = uid('pty');
  await db.runAsync(
    'INSERT INTO parties (id, kind, name, phone, address, gstin, balance, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    customerId,
    'customer',
    'Ramesh Patel',
    '9876543210',
    'Maninagar, Ahmedabad',
    '',
    250,
    nowIso(),
  );
  await addLedger(db, customerId, 'opening', 250, 0, '', '');
  await db.runAsync(
    'INSERT INTO parties (id, kind, name, phone, address, gstin, balance, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    supplierId,
    'supplier',
    'Patel Traders',
    '9825012345',
    'Kalupur, Ahmedabad',
    '',
    1800,
    nowIso(),
  );
  await addLedger(db, supplierId, 'opening', 0, 1800, '', '');
}

export async function completeSetup(input: {
  shopName: string;
  shopNameGu: string;
  phone: string;
  address: string;
  gstin: string;
  language: Lang;
  ownerName: string;
  pin: string;
  sample: boolean;
  taxInclusive: boolean;
}) {
  const shopName = input.shopName.trim();
  const ownerName = input.ownerName.trim();
  if (!shopName) fail('shop_required');
  if (!ownerName) fail('name_required');
  if (!/^\d{4,6}$/.test(input.pin)) fail('pin_rule');
  const db = await getDb();
  const userId = uid('usr');
  const pinHash = await hashPin(input.pin);
  await db.withTransactionAsync(async () => {
    const pairs: [string, string][] = [
      ['shopName', shopName],
      ['shopNameGu', input.shopNameGu.trim()],
      ['phone', input.phone.trim()],
      ['address', input.address.trim()],
      ['gstin', input.gstin.trim().toUpperCase()],
      ['language', input.language],
      ['taxInclusive', input.taxInclusive ? '1' : '0'],
      ['paperWidth', '58'],
      ['printerAddress', ''],
      ['printerName', ''],
      ['invoicePrefix', 'CS'],
      ['invoiceSeq', '0'],
      ['purchaseSeq', '0'],
      ['returnSeq', '0'],
      ['setupDone', '1'],
      ['currentUserId', userId],
    ];
    for (const [key, value] of pairs) await putSetting(db, key, value);
    await db.runAsync(
      'INSERT INTO users (id, name, pin_hash, role, active, created_at) VALUES (?, ?, ?, ?, 1, ?)',
      userId,
      ownerName,
      pinHash,
      'admin',
      nowIso(),
    );
    if (input.sample) await insertSample(db);
  });
  const user = await getUser(userId);
  if (!user) fail('failed');
  return user;
}

export async function wipeAll() {
  const db = await getDb();
  await db.execAsync(`
    DELETE FROM return_items;
    DELETE FROM returns;
    DELETE FROM invoice_items;
    DELETE FROM invoices;
    DELETE FROM purchase_items;
    DELETE FROM purchases;
    DELETE FROM expenses;
    DELETE FROM cash_moves;
    DELETE FROM cash_sessions;
    DELETE FROM ledger;
    DELETE FROM parties;
    DELETE FROM products;
    DELETE FROM users;
    DELETE FROM settings;
  `);
}

export async function dueInvoices(partyId: string) {
  const db = await getDb();
  const rows = await db.getAllAsync<Parameters<typeof mapInvoice>[0]>(
    'SELECT * FROM invoices WHERE party_id = ? AND due > 0.001 ORDER BY date ASC',
    partyId,
  );
  return rows.map(mapInvoice);
}

export async function duePurchases(partyId: string) {
  const db = await getDb();
  const rows = await db.getAllAsync<Parameters<typeof mapPurchase>[0]>(
    'SELECT * FROM purchases WHERE party_id = ? AND due > 0.001 ORDER BY date ASC',
    partyId,
  );
  return rows.map(mapPurchase);
}

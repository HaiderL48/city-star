import type { Lang } from '@/lib/format';

export type Role = 'admin' | 'manager' | 'cashier';
export type PayMode = 'cash' | 'upi' | 'card' | 'credit';
export type PartyKind = 'customer' | 'supplier';
export type BillStatus = 'paid' | 'partial' | 'unpaid' | 'returned';
export type PaperWidth = '58' | '80';

export type Settings = {
  shopName: string;
  shopNameGu: string;
  phone: string;
  address: string;
  gstin: string;
  language: Lang;
  taxInclusive: boolean;
  paperWidth: PaperWidth;
  printerAddress: string;
  printerName: string;
  invoicePrefix: string;
  invoiceSeq: number;
  purchaseSeq: number;
  returnSeq: number;
  setupDone: boolean;
  currentUserId: string;
};

export type User = {
  id: string;
  name: string;
  role: Role;
  active: boolean;
  createdAt: string;
};

export type Product = {
  id: string;
  name: string;
  nameGu: string;
  sku: string;
  category: string;
  unit: string;
  salePrice: number;
  purchasePrice: number;
  gstRate: number;
  stock: number;
  lowStock: number;
  active: boolean;
};

export type Party = {
  id: string;
  kind: PartyKind;
  name: string;
  phone: string;
  address: string;
  gstin: string;
  balance: number;
  createdAt: string;
};

export type LedgerEntry = {
  id: string;
  partyId: string;
  date: string;
  kind: string;
  refId: string;
  note: string;
  debit: number;
  credit: number;
  createdAt: string;
};

export type Invoice = {
  id: string;
  number: string;
  date: string;
  partyId: string | null;
  partyName: string;
  partyPhone: string;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paid: number;
  due: number;
  paymentMode: PayMode;
  status: BillStatus;
  note: string;
  userId: string;
  userName: string;
  createdAt: string;
};

export type InvoiceItem = {
  id: string;
  invoiceId: string;
  productId: string | null;
  name: string;
  nameGu: string;
  unit: string;
  qty: number;
  returnedQty: number;
  rate: number;
  gstRate: number;
  taxable: number;
  tax: number;
  total: number;
  purchasePrice: number;
};

export type Purchase = {
  id: string;
  number: string;
  date: string;
  partyId: string | null;
  partyName: string;
  subtotal: number;
  tax: number;
  total: number;
  paid: number;
  due: number;
  paymentMode: PayMode;
  note: string;
  userId: string;
  userName: string;
  createdAt: string;
};

export type PurchaseItem = {
  id: string;
  purchaseId: string;
  productId: string | null;
  name: string;
  nameGu: string;
  unit: string;
  qty: number;
  rate: number;
  gstRate: number;
  total: number;
};

export type Expense = {
  id: string;
  date: string;
  category: string;
  amount: number;
  paymentMode: Exclude<PayMode, 'credit'>;
  note: string;
  userId: string;
  userName: string;
  createdAt: string;
};

export type SaleReturn = {
  id: string;
  number: string;
  date: string;
  invoiceId: string;
  invoiceNumber: string;
  partyId: string | null;
  partyName: string;
  total: number;
  refundMode: 'cash' | 'upi' | 'credit';
  note: string;
  userId: string;
  userName: string;
  createdAt: string;
};

export type CashSession = {
  id: string;
  openedAt: string;
  closedAt: string | null;
  openingCash: number;
  closingCash: number | null;
  expectedCash: number | null;
  difference: number | null;
  note: string;
  status: 'open' | 'closed';
  userId: string;
  userName: string;
};

export type CashMove = {
  id: string;
  sessionId: string;
  createdAt: string;
  kind: string;
  amount: number;
  direction: 'in' | 'out';
  note: string;
  refId: string;
};

export type CartInput = {
  productId: string | null;
  name: string;
  nameGu: string;
  unit: string;
  qty: number;
  rate: number;
  gstRate: number;
  purchasePrice: number;
};

export type Actor = {
  id: string;
  name: string;
};

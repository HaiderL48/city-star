import type { Role } from '@/db/types';

export function abilities(role: Role) {
  const manager = role === 'admin' || role === 'manager';
  return {
    profit: manager,
    purchases: manager,
    expenses: manager,
    editStock: manager,
    reports: manager,
    staff: role === 'admin',
    wipe: role === 'admin',
    shopEdit: manager,
    payables: manager,
    purchasePrice: manager,
  };
}

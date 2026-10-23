import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import type { Product } from '@/db/types';
import { round3, uid } from '@/lib/format';

export type CartLine = {
  key: string;
  productId: string | null;
  name: string;
  nameGu: string;
  unit: string;
  qty: number;
  rate: number;
  gstRate: number;
  purchasePrice: number;
};

type CartValue = {
  lines: CartLine[];
  discount: number;
  setDiscount: (value: number) => void;
  addProduct: (product: Product) => void;
  addCustom: (line: Omit<CartLine, 'key' | 'productId'>) => void;
  update: (key: string, patch: Partial<Pick<CartLine, 'qty' | 'rate' | 'gstRate'>>) => void;
  remove: (key: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [discount, setDiscount] = useState(0);

  const addProduct = useCallback((product: Product) => {
    setLines((current) => {
      const found = current.find((line) => line.productId === product.id);
      if (found) {
        return current.map((line) => (line.productId === product.id ? { ...line, qty: round3(line.qty + 1) } : line));
      }
      return [
        ...current,
        {
          key: product.id,
          productId: product.id,
          name: product.name,
          nameGu: product.nameGu,
          unit: product.unit,
          qty: 1,
          rate: product.salePrice,
          gstRate: product.gstRate,
          purchasePrice: product.purchasePrice,
        },
      ];
    });
  }, []);

  const addCustom = useCallback((line: Omit<CartLine, 'key' | 'productId'>) => {
    setLines((current) => [...current, { ...line, key: uid('cus'), productId: null }]);
  }, []);

  const update = useCallback((key: string, patch: Partial<Pick<CartLine, 'qty' | 'rate' | 'gstRate'>>) => {
    setLines((current) =>
      current
        .map((line) => (line.key === key ? { ...line, ...patch, qty: patch.qty === undefined ? line.qty : round3(patch.qty) } : line))
        .filter((line) => line.qty > 0),
    );
  }, []);

  const remove = useCallback((key: string) => {
    setLines((current) => current.filter((line) => line.key !== key));
  }, []);

  const clear = useCallback(() => {
    setLines([]);
    setDiscount(0);
  }, []);

  const value = useMemo(
    () => ({ lines, discount, setDiscount, addProduct, addCustom, update, remove, clear }),
    [lines, discount, addProduct, addCustom, update, remove, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error('Cart missing');
  return value;
}

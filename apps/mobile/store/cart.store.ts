import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { MMKV } from 'react-native-mmkv';

// @ts-ignore
const storage = new MMKV({ id: 'bazarbd-cart' });

const mmkvStorage = {
  setItem:    (key: string, value: string) => storage.set(key, value),
  getItem:    (key: string) => storage.getString(key) ?? null,
  removeItem: (key: string) => storage.delete(key),
};

interface CartItem {
  variantId:  string;
  quantity:   number;
  name:       string;
  price:      number;
  imageUrl?:  string;
  attributes?: Record<string, string>;
}

interface CartStore {
  items:        CartItem[];
  itemCount:    number;
  subtotal:     number;
  addItem:      (item: CartItem) => void;
  removeItem:   (variantId: string) => void;
  updateQty:    (variantId: string, quantity: number) => void;
  clearCart:    () => void;
  syncFromServer: (serverItems: CartItem[]) => void;
}

function recalc(items: CartItem[]) {
  return {
    itemCount: items.reduce((s, i) => s + i.quantity, 0),
    subtotal:  items.reduce((s, i) => s + i.price * i.quantity, 0),
  };
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items:     [],
      itemCount: 0,
      subtotal:  0,

      addItem: (item) => {
        const items = [...get().items];
        const idx   = items.findIndex((i) => i.variantId === item.variantId);
        if (idx >= 0) {
          items[idx] = { ...items[idx], quantity: Math.min(99, items[idx].quantity + item.quantity) };
        } else {
          items.push(item);
        }
        set({ items, ...recalc(items) });
      },

      removeItem: (variantId) => {
        const items = get().items.filter((i) => i.variantId !== variantId);
        set({ items, ...recalc(items) });
      },

      updateQty: (variantId, quantity) => {
        const items = quantity <= 0
          ? get().items.filter((i) => i.variantId !== variantId)
          : get().items.map((i) => i.variantId === variantId ? { ...i, quantity } : i);
        set({ items, ...recalc(items) });
      },

      clearCart: () => set({ items: [], itemCount: 0, subtotal: 0 }),

      syncFromServer: (serverItems) => {
        set({ items: serverItems, ...recalc(serverItems) });
      },
    }),
    {
      name:    'bazarbd-cart',
      storage: createJSONStorage(() => mmkvStorage),
    },
  ),
);

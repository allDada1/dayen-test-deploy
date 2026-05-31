import { createContext, useContext, useMemo, useState, type PropsWithChildren } from "react";

import { storage } from "../services/storage";
import { useToast } from "./toast";

type CartContextValue = {
  items: number[];
  add: (productId: number, options?: { silent?: boolean }) => boolean;
  addMany: (productIds: number[], options?: { silent?: boolean }) => { added: number; skipped: number };
  remove: (productId: number, options?: { silent?: boolean }) => void;
  clear: (options?: { silent?: boolean }) => void;
  has: (productId: number) => boolean;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: PropsWithChildren) {
  const [items, setItems] = useState<number[]>(() => storage.getCart());
  const toast = useToast();

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      add(productId, options) {
        let added = false;
        setItems((current) => {
          added = !current.includes(productId);
          const next = added ? [...current, productId] : current;
          storage.setCart(next);
          return next;
        });

        if (!options?.silent) {
          toast.success(added ? "Товар успешно добавлен в корзину." : "Товар уже есть в корзине.", {
            title: added ? "Добавлено в корзину" : "Уже в корзине",
            action: { label: "Открыть корзину", href: "/cart" },
          });
        }

        return added;
      },
      addMany(productIds, options) {
        const uniqueIds = [...new Set(productIds.filter((id) => Number.isFinite(id) && id > 0))];
        let added = 0;
        let skipped = 0;

        setItems((current) => {
          const next = [...current];
          for (const productId of uniqueIds) {
            if (next.includes(productId)) {
              skipped += 1;
              continue;
            }
            next.push(productId);
            added += 1;
          }
          storage.setCart(next);
          return next;
        });

        if (!options?.silent) {
          if (added && skipped) {
            toast.success(`Добавлено товаров: ${added}. Уже было в корзине: ${skipped}.`, {
              title: "Корзина обновлена",
              action: { label: "Открыть корзину", href: "/cart" },
            });
          } else if (added) {
            toast.success(added === 1 ? "Товар успешно добавлен в корзину." : `В корзину добавлено ${added} товаров.`, {
              title: "Добавлено в корзину",
              action: { label: "Открыть корзину", href: "/cart" },
            });
          } else {
            toast.info("Все товары из этого заказа уже были в корзине.", {
              title: "Корзина без изменений",
              action: { label: "Открыть корзину", href: "/cart" },
            });
          }
        }

        return { added, skipped };
      },
      remove(productId, options) {
        setItems((current) => {
          const next = current.filter((id) => id !== productId);
          storage.setCart(next);
          return next;
        });

        if (!options?.silent) {
          toast.info("Товар удален из корзины.");
        }
      },
      clear(options) {
        storage.setCart([]);
        setItems([]);

        if (!options?.silent) {
          toast.info("Корзина очищена.");
        }
      },
      has(productId) {
        return items.includes(productId);
      },
    }),
    [items, toast],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCart must be used within CartProvider");
  return value;
}

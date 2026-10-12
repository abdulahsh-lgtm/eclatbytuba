"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export interface CartItem {
  id: string;
  productId: string;
  variantId?: string | null;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string | null;
  slug: string;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity"> & { quantity?: number }) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  subtotal: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_KEY = "eclat_cart";

function isCartItem(value: unknown): value is CartItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<CartItem>;
  return (
    typeof item.id === "string" &&
    typeof item.productId === "string" &&
    typeof item.name === "string" &&
    typeof item.slug === "string" &&
    typeof item.price === "number" &&
    Number.isFinite(item.price) &&
    item.price >= 0 &&
    typeof item.quantity === "number" &&
    Number.isInteger(item.quantity) &&
    item.quantity >= 1 &&
    item.quantity <= 100 &&
    (item.variantId == null || typeof item.variantId === "string") &&
    (item.imageUrl == null || typeof item.imageUrl === "string")
  );
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(CART_KEY);
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        setItems(Array.isArray(parsed) ? parsed.filter(isCartItem) : []);
      }
    } catch {
      setItems([]);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(items));
    } catch {
      // Cart remains usable for this page session if storage is unavailable.
    }
  }, [items, hydrated]);

  const addItem = (item: Omit<CartItem, "quantity"> & { quantity?: number }) => {
    setItems((prev) => {
      const variantId = item.variantId ?? null;
      const requestedQuantity =
        typeof item.quantity === "number" && Number.isInteger(item.quantity)
          ? Math.min(100, Math.max(1, item.quantity))
          : 1;
      const existing = prev.find(
        (i) => i.productId === item.productId && (i.variantId ?? null) === variantId
      );
      if (existing) {
        return prev.map((i) =>
          i.id === existing.id
            ? { ...i, quantity: Math.min(100, i.quantity + requestedQuantity) }
            : i
        );
      }
      return [
        ...prev,
        {
          ...item,
          variantId,
          id: `${item.productId}-${variantId || "default"}-${Date.now()}`,
          quantity: requestedQuantity,
        },
      ];
    });
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const updateQuantity = (id: string, quantity: number) => {
    if (!Number.isInteger(quantity) || quantity < 1) {
      removeItem(id);
      return;
    }
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, quantity: Math.min(100, quantity) } : i))
    );
  };

  const clearCart = () => setItems([]);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return (
    <CartContext.Provider
      value={{ items, addItem, removeItem, updateQuantity, clearCart, totalItems, subtotal }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}

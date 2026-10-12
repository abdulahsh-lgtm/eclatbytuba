/**
 * Phase 1 — Server-authoritative checkout helpers.
 * Client may send productId + quantity (+ optional variantId).
 * Never trusts client price, subtotal, shippingCost, discount, total, or orderNumber.
 */

import {
  resolveShippingCost,
  MAX_LINE_QUANTITY,
  MAX_ORDER_LINES,
  type ShippingMethodId,
} from "@eclat/config";

export type CheckoutLineInput = {
  productId: string;
  quantity: number;
  variantId?: string | null;
  /** Ignored if present — client must not control price */
  price?: unknown;
  name?: unknown;
};

export type CreateOrderSecureInput = {
  email: string;
  phone?: string;
  shippingAddress: Record<string, unknown>;
  items: CheckoutLineInput[];
  paymentMethod?: string;
  /** Method key only — cost resolved server-side */
  shippingMethod?: string | null;
  /** Ignored — never authoritative */
  shippingCost?: unknown;
  discount?: unknown;
  subtotal?: unknown;
  total?: unknown;
  orderNumber?: unknown;
  amount?: unknown;
  idempotencyKey?: string | null;
};

export class CheckoutError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "VALIDATION"
      | "NOT_FOUND"
      | "INSUFFICIENT_STOCK"
      | "CONFLICT"
  ) {
    super(message);
    this.name = "CheckoutError";
  }
}

export function validateEmail(email: unknown): string {
  if (typeof email !== "string" || !email.trim()) {
    throw new CheckoutError("A valid email is required", "VALIDATION");
  }
  const e = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) || e.length > 254) {
    throw new CheckoutError("A valid email is required", "VALIDATION");
  }
  return e;
}

export function validateQuantity(q: unknown): number {
  if (typeof q !== "number" || !Number.isInteger(q)) {
    throw new CheckoutError("Quantity must be a whole number", "VALIDATION");
  }
  if (q < 1) {
    throw new CheckoutError("Quantity must be at least 1", "VALIDATION");
  }
  if (q > MAX_LINE_QUANTITY) {
    throw new CheckoutError(
      `Quantity cannot exceed ${MAX_LINE_QUANTITY} per item`,
      "VALIDATION"
    );
  }
  return q;
}

export function normalizeCheckoutItems(
  items: CheckoutLineInput[] | undefined
): { productId: string; quantity: number; variantId: string | null }[] {
  if (!Array.isArray(items) || items.length === 0) {
    throw new CheckoutError("At least one item is required", "VALIDATION");
  }
  if (items.length > MAX_ORDER_LINES) {
    throw new CheckoutError("Too many line items", "VALIDATION");
  }
  const merged = new Map<
    string,
    { productId: string; quantity: number; variantId: string | null }
  >();
  for (const raw of items) {
    if (!raw || typeof raw.productId !== "string" || !raw.productId.trim()) {
      throw new CheckoutError("Each item needs a productId", "VALIDATION");
    }
    const productId = raw.productId.trim();
    const quantity = validateQuantity(raw.quantity);
    const variantId =
      typeof raw.variantId === "string" && raw.variantId.trim()
        ? raw.variantId.trim()
        : null;
    const key = `${productId}::${variantId || "default"}`;
    const prev = merged.get(key);
    if (prev) {
      const nextQty = prev.quantity + quantity;
      if (nextQty > MAX_LINE_QUANTITY) {
        throw new CheckoutError(
          `Quantity cannot exceed ${MAX_LINE_QUANTITY} per item`,
          "VALIDATION"
        );
      }
      prev.quantity = nextQty;
    } else {
      merged.set(key, { productId, quantity, variantId });
    }
  }
  return Array.from(merged.values());
}

export function computeLineTotal(unitPrice: number, quantity: number): number {
  if (unitPrice < 0 || quantity < 1) {
    throw new CheckoutError("Invalid line amounts", "VALIDATION");
  }
  return Math.round(unitPrice * quantity * 100) / 100;
}

export function computeOrderTotals(
  lines: { lineTotal: number }[],
  shippingMethod?: string | null
): {
  subtotal: number;
  shippingCost: number;
  tax: number;
  discount: number;
  total: number;
  currency: string;
  shippingMethod: ShippingMethodId;
} {
  const subtotal =
    Math.round(lines.reduce((s, l) => s + l.lineTotal, 0) * 100) / 100;
  const { method, costPkr } = resolveShippingCost(shippingMethod);
  const tax = 0;
  const discount = 0;
  const total = Math.round((subtotal - discount + costPkr + tax) * 100) / 100;
  if (total < 0) {
    throw new CheckoutError("Order total cannot be negative", "VALIDATION");
  }
  return {
    subtotal,
    shippingCost: costPkr,
    tax,
    discount,
    total,
    currency: "PKR",
    shippingMethod: method,
  };
}

export function generateOrderNumber(): string {
  const t = Date.now().toString(36).toUpperCase();
  const r = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `ORD-${t}-${r}`;
}

export function normalizeIdempotencyKey(key: unknown): string | null {
  if (key == null || key === "") return null;
  if (typeof key !== "string") {
    throw new CheckoutError("Invalid idempotency key", "VALIDATION");
  }
  const k = key.trim();
  if (k.length < 8 || k.length > 128) {
    throw new CheckoutError(
      "Idempotency key must be 8–128 characters",
      "VALIDATION"
    );
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(k)) {
    throw new CheckoutError(
      "Idempotency key has invalid characters",
      "VALIDATION"
    );
  }
  return k;
}

export function validateShippingAddress(
  addr: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  if (!addr || typeof addr !== "object") {
    throw new CheckoutError("Shipping address is required", "VALIDATION");
  }
  const fullName = String(addr.fullName || "").trim();
  const line1 = String(addr.line1 || "").trim();
  const city = String(addr.city || "").trim();
  if (!fullName || !line1 || !city) {
    throw new CheckoutError(
      "Full name, address, and city are required",
      "VALIDATION"
    );
  }
  return {
    fullName,
    line1,
    line2: addr.line2 ? String(addr.line2).trim() : undefined,
    city,
    postalCode: addr.postalCode ? String(addr.postalCode).trim() : undefined,
    country: "PK",
    shippingMethod:
      addr.shippingMethod === "express" ? "express" : "standard",
  };
}

export function assertFinancialInvariants(order: {
  subtotal: number;
  shippingCost: number;
  tax: number;
  discount: number;
  total: number;
  items: { price: number; quantity: number; total: number }[];
}): void {
  const linesSum =
    Math.round(
      order.items.reduce((s, i) => s + i.price * i.quantity, 0) * 100
    ) / 100;
  if (Math.abs(linesSum - order.subtotal) > 0.01) {
    throw new CheckoutError("Subtotal invariant failed", "VALIDATION");
  }
  for (const i of order.items) {
    const expected = computeLineTotal(i.price, i.quantity);
    if (Math.abs(expected - i.total) > 0.01) {
      throw new CheckoutError("Line total invariant failed", "VALIDATION");
    }
  }
  const expectedTotal =
    Math.round(
      (order.subtotal - order.discount + order.shippingCost + order.tax) * 100
    ) / 100;
  if (Math.abs(expectedTotal - order.total) > 0.01) {
    throw new CheckoutError("Total invariant failed", "VALIDATION");
  }
  if (order.total < 0 || order.subtotal < 0) {
    throw new CheckoutError("Negative amounts not allowed", "VALIDATION");
  }
}

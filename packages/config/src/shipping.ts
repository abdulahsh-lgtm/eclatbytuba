/** Server-authoritative shipping rates (PKR). Client may only send method id. */

export type ShippingMethodId = "standard" | "express";

export const SHIPPING_METHODS: Record<
  ShippingMethodId,
  { id: ShippingMethodId; label: string; cost: number }
> = {
  standard: { id: "standard", label: "Standard", cost: 250 },
  express: { id: "express", label: "Express", cost: 500 },
};

export const DEFAULT_SHIPPING_METHOD: ShippingMethodId = "standard";

/** Max units per line and lines per order (abuse guards). */
export const MAX_LINE_QUANTITY = 20;
export const MAX_ORDER_LINES = 30;

export function resolveShippingCost(method?: string | null): number {
  const id = (method || DEFAULT_SHIPPING_METHOD) as ShippingMethodId;
  return SHIPPING_METHODS[id]?.cost ?? SHIPPING_METHODS.standard.cost;
}

export function isShippingMethodId(v: unknown): v is ShippingMethodId {
  return v === "standard" || v === "express";
}

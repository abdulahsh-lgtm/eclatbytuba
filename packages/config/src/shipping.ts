/** Server-authoritative shipping rates (PKR). Client may only send method id. */

export type ShippingMethodId = "standard" | "express";

export const SHIPPING_METHODS: Record<
  ShippingMethodId,
  { label: string; costPkr: number }
> = {
  standard: { label: "Standard (3–5 days)", costPkr: 250 },
  express: { label: "Express (1–2 days)", costPkr: 350 },
};

export const MAX_LINE_QUANTITY = 20;
export const MAX_ORDER_LINES = 30;

/**
 * Resolve shipping cost from method id only.
 * Unknown / free-shipping hacks fall back to standard — never trust client cost.
 */
export function resolveShippingCost(method?: string | null): {
  method: ShippingMethodId;
  costPkr: number;
} {
  if (method === "express") {
    return { method: "express", costPkr: SHIPPING_METHODS.express.costPkr };
  }
  return { method: "standard", costPkr: SHIPPING_METHODS.standard.costPkr };
}

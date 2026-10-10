/**
 * Phase 2 — Payment / order status state machine.
 * Client input must never set trusted payment status.
 */

export type PaymentStatusValue = "PENDING" | "PAID" | "FAILED" | "REFUNDED";
export type OrderStatusValue =
  | "PENDING"
  | "CONFIRMED"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED";

/** Allowed payment status transitions. Terminal states have empty sets. */
export const PAYMENT_TRANSITIONS: Record<
  PaymentStatusValue,
  ReadonlySet<PaymentStatusValue>
> = {
  PENDING: new Set(["PAID", "FAILED", "REFUNDED"]),
  PAID: new Set(["REFUNDED"]),
  FAILED: new Set(["PENDING", "PAID"]), // allow retry → PENDING or eventual PAID
  REFUNDED: new Set(),
};

/** Order statuses that may still accept a successful payment confirmation. */
export const ORDER_PAYABLE_STATUSES: ReadonlySet<OrderStatusValue> = new Set([
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
]);

export function canTransitionPayment(
  from: string,
  to: string
): boolean {
  const allowed = PAYMENT_TRANSITIONS[from as PaymentStatusValue];
  if (!allowed) return false;
  return allowed.has(to as PaymentStatusValue);
}

export function isOrderPayable(status: string, paymentStatus: string): boolean {
  if (paymentStatus === "PAID") return false;
  if (status === "CANCELLED" || status === "REFUNDED") return false;
  return ORDER_PAYABLE_STATUSES.has(status as OrderStatusValue);
}

/**
 * Whether a verified payment_intent.succeeded may mark this order PAID.
 * Rejects already-PAID, cancelled, refunded, and non-payable order states.
 */
export function canMarkOrderPaid(
  orderStatus: string,
  paymentStatus: string
): { ok: true } | { ok: false; reason: string } {
  if (paymentStatus === "PAID") {
    return { ok: false, reason: "already_paid" };
  }
  if (paymentStatus === "REFUNDED") {
    return { ok: false, reason: "refunded" };
  }
  if (orderStatus === "CANCELLED") {
    return { ok: false, reason: "cancelled" };
  }
  if (orderStatus === "REFUNDED") {
    return { ok: false, reason: "order_refunded" };
  }
  if (!ORDER_PAYABLE_STATUSES.has(orderStatus as OrderStatusValue)) {
    return { ok: false, reason: "order_not_payable" };
  }
  if (!canTransitionPayment(paymentStatus || "PENDING", "PAID")) {
    return { ok: false, reason: "invalid_payment_transition" };
  }
  return { ok: true };
}

export function canMarkPaymentFailed(
  paymentStatus: string
): boolean {
  return canTransitionPayment(paymentStatus || "PENDING", "FAILED");
}

/**
 * Phase 2 — DB-backed payment confirmation (transactional).
 * In-memory fallbacks live in data.ts for tests.
 */
import { canMarkOrderPaid, canMarkPaymentFailed } from "./payment-state";

export async function confirmOrderPaidDb(input: {
  orderId: string;
  paymentIntentId: string;
  amountMinor: number;
  currency: string;
  stripeEventId?: string | null;
}): Promise<
  | { ok: true; alreadyPaid?: boolean }
  | { ok: false; reason: string }
> {
  const { prisma } = await import("./index");

  if (input.stripeEventId) {
    try {
      await prisma.stripeWebhookEvent.create({
        data: {
          eventId: input.stripeEventId,
          type: "payment_intent.succeeded",
          orderId: input.orderId,
          payloadMeta: {
            paymentIntentId: input.paymentIntentId,
            amountMinor: input.amountMinor,
            currency: input.currency,
          },
        },
      });
    } catch (err: any) {
      if (err?.code === "P2002") {
        return { ok: true, alreadyPaid: true };
      }
      console.warn("StripeWebhookEvent insert skipped:", err?.code || err);
    }
  }

  try {
    return await prisma.$transaction(async (tx: any) => {
      const order = await tx.order.findUnique({
        where: { id: input.orderId },
        include: { payments: true },
      });
      if (!order) return { ok: false as const, reason: "order_not_found" };

      const gate = canMarkOrderPaid(
        String(order.status),
        String(order.paymentStatus)
      );
      if (!gate.ok) {
        if (gate.reason === "already_paid") {
          return { ok: true as const, alreadyPaid: true };
        }
        return { ok: false as const, reason: gate.reason };
      }

      const orderTotalMinor = Math.round(Number(order.total) * 100);
      const orderCurrency = String(order.currency || "PKR").toLowerCase();
      if (
        input.amountMinor !== orderTotalMinor ||
        input.currency.toLowerCase() !== orderCurrency
      ) {
        return { ok: false as const, reason: "amount_currency_mismatch" };
      }

      await tx.order.update({
        where: { id: input.orderId },
        data: {
          paymentStatus: "PAID",
          status: order.status === "PENDING" ? "CONFIRMED" : order.status,
          paidAt: new Date(),
        },
      });

      const payments = order.payments || [];
      if (payments.length > 0) {
        await tx.payment.updateMany({
          where: {
            orderId: input.orderId,
            status: { in: ["PENDING", "FAILED"] },
          },
          data: {
            status: "PAID",
            transactionId: input.paymentIntentId,
          },
        });
      } else {
        await tx.payment.create({
          data: {
            orderId: input.orderId,
            amount: order.total,
            currency: order.currency || "PKR",
            method: "card",
            status: "PAID",
            transactionId: input.paymentIntentId,
          },
        });
      }

      return { ok: true as const };
    });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return { ok: true, alreadyPaid: true };
    }
    throw err;
  }
}

export async function markPaymentFailedDb(input: {
  orderId: string;
  paymentIntentId: string;
  stripeEventId?: string | null;
}): Promise<{ ok: true; skipped?: boolean } | { ok: false; reason: string }> {
  const { prisma } = await import("./index");

  if (input.stripeEventId) {
    try {
      await prisma.stripeWebhookEvent.create({
        data: {
          eventId: input.stripeEventId,
          type: "payment_intent.payment_failed",
          orderId: input.orderId,
          payloadMeta: { paymentIntentId: input.paymentIntentId },
        },
      });
    } catch (err: any) {
      if (err?.code === "P2002") {
        return { ok: true, skipped: true };
      }
      console.warn("StripeWebhookEvent insert skipped:", err?.code || err);
    }
  }

  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    include: { payments: true },
  });
  if (!order) return { ok: false, reason: "order_not_found" };
  if (String(order.paymentStatus) === "PAID") {
    return { ok: false, reason: "already_paid" };
  }
  if (!canMarkPaymentFailed(String(order.paymentStatus))) {
    return { ok: false, reason: "invalid_transition" };
  }

  await prisma.payment.updateMany({
    where: { orderId: input.orderId, status: "PENDING" },
    data: {
      status: "FAILED",
      transactionId: input.paymentIntentId,
    },
  });
  return { ok: true };
}

export async function attachPaymentIntentDb(
  orderId: string,
  paymentIntentId: string
): Promise<void> {
  const { prisma } = await import("./index");
  await prisma.payment.updateMany({
    where: { orderId, status: "PENDING" },
    data: { transactionId: paymentIntentId },
  });
}

export async function getExistingPaymentIntentIdDb(
  orderId: string
): Promise<string | null> {
  const { prisma } = await import("./index");
  const payment = await prisma.payment.findFirst({
    where: {
      orderId,
      status: "PENDING",
      transactionId: { not: null },
    },
    orderBy: { createdAt: "desc" },
  });
  const tid = payment?.transactionId;
  if (tid && String(tid).startsWith("pi_")) return String(tid);
  return null;
}

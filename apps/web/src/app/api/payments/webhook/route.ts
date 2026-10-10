import { NextRequest, NextResponse } from "next/server";
import { getOrderById, updateOrderStatus } from "@eclat/db";

/**
 * Stripe webhook handler.
 * Signature verification is required. Amount/currency consistency is checked against the order.
 * On success: confirms order and marks payment PAID when possible.
 */
export async function POST(req: NextRequest) {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();

  if (!secretKey || !webhookSecret) {
    return NextResponse.json(
      { error: "Stripe not configured" },
      { status: 503 }
    );
  }

  try {
    const body = await req.text();
    const sig = req.headers.get("stripe-signature") || "";

    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(secretKey, { apiVersion: "2024-06-20" });

    let event;
    try {
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    } catch {
      console.error("Webhook signature verification failed");
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    switch (event.type) {
      case "payment_intent.succeeded": {
        const intent = event.data.object as {
          id: string;
          amount: number;
          currency: string;
          metadata?: { orderId?: string };
        };
        const orderId = intent.metadata?.orderId;
        if (!orderId) {
          console.warn("Payment succeeded without orderId metadata:", intent.id);
          break;
        }

        const order = await getOrderById(orderId);
        if (!order) {
          console.warn("Payment for unknown order:", orderId, intent.id);
          break;
        }

        // Idempotent: already paid
        if (String((order as any).paymentStatus) === "PAID") {
          console.log("Order already paid:", orderId);
          break;
        }

        const orderTotalMinor = Math.round(Number((order as any).total) * 100);
        const orderCurrency = String((order as any).currency || "PKR").toLowerCase();

        if (
          intent.amount !== orderTotalMinor ||
          intent.currency.toLowerCase() !== orderCurrency
        ) {
          console.error("Payment amount/currency mismatch", {
            orderId,
            expectedAmount: orderTotalMinor,
            gotAmount: intent.amount,
            expectedCurrency: orderCurrency,
            gotCurrency: intent.currency,
          });
          break;
        }

        try {
          await updateOrderStatus(orderId, "CONFIRMED");
          // Best-effort: update payment records if prisma available
          try {
            const { prisma } = await import("@eclat/db");
            if (prisma?.payment?.updateMany) {
              await prisma.payment.updateMany({
                where: { orderId },
                data: {
                  status: "PAID",
                  transactionId: intent.id,
                },
              });
              await prisma.order.update({
                where: { id: orderId },
                data: {
                  paymentStatus: "PAID",
                  paidAt: new Date(),
                },
              });
            }
          } catch (payErr) {
            console.warn("Payment row update skipped:", payErr);
          }
        } catch (updateErr) {
          console.error("Failed to update order after payment:", updateErr);
        }
        console.log("Payment succeeded:", intent.id, "order:", orderId);
        break;
      }
      case "payment_intent.payment_failed": {
        const intent = event.data.object as { id: string; metadata?: { orderId?: string } };
        console.log("Payment failed:", intent.id);
        if (intent.metadata?.orderId) {
          try {
            const { prisma } = await import("@eclat/db");
            if (prisma?.payment?.updateMany) {
              await prisma.payment.updateMany({
                where: { orderId: intent.metadata.orderId },
                data: { status: "FAILED", transactionId: intent.id },
              });
            }
          } catch {
            /* best-effort */
          }
        }
        break;
      }
      default:
        console.log("Unhandled event:", event.type);
    }

    return NextResponse.json({ received: true });
  } catch (e: unknown) {
    console.error("Webhook error:", e);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 400 }
    );
  }
}

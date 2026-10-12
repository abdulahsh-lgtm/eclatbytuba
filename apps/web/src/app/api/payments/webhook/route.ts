import { NextRequest, NextResponse } from "next/server";
import {
  confirmOrderPaid,
  markPaymentFailed,
} from "@eclat/db";

/**
 * Phase 2 — Stripe webhook handler.
 * - Signature verified against raw body
 * - Event processing is idempotent (StripeWebhookEvent ledger + state machine)
 * - Order marked PAID only when amount/currency/order match verified intent
 * - Never trusts client input for payment status
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
          status?: string;
        };

        // Only accept successful intents
        if (intent.status && intent.status !== "succeeded") {
          console.warn("Ignoring non-succeeded intent status:", intent.status);
          break;
        }

        const orderId = intent.metadata?.orderId;
        if (!orderId) {
          console.warn("Payment succeeded without orderId metadata:", intent.id);
          break;
        }

        const result = await confirmOrderPaid({
          orderId,
          paymentIntentId: intent.id,
          amountMinor: intent.amount,
          currency: intent.currency,
          stripeEventId: event.id,
        });

        if (!result.ok) {
          console.error("confirmOrderPaid rejected:", result.reason, {
            orderId,
            intentId: intent.id,
          });
          // Return 200 so Stripe does not retry forever on business rejects
          // (mismatch / cancelled). Signature was valid.
          break;
        }
        if (result.alreadyPaid) {
          console.log("Idempotent webhook: already paid", orderId, event.id);
        } else {
          console.log("Payment confirmed:", intent.id, "order:", orderId);
        }
        break;
      }
      case "payment_intent.payment_failed": {
        const intent = event.data.object as {
          id: string;
          metadata?: { orderId?: string };
        };
        const orderId = intent.metadata?.orderId;
        if (!orderId) {
          console.log("Payment failed without orderId:", intent.id);
          break;
        }
        const result = await markPaymentFailed({
          orderId,
          paymentIntentId: intent.id,
          stripeEventId: event.id,
        });
        if (!result.ok) {
          console.warn("markPaymentFailed:", result.reason, orderId);
        } else {
          console.log("Payment marked failed:", intent.id, orderId);
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

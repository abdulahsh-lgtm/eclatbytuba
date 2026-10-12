import { NextRequest, NextResponse } from "next/server";
import { verifyOrderPaymentToken } from "@eclat/auth";
import {
  getOrderById,
  getExistingPaymentIntentId,
  attachPaymentIntent,
  isOrderPayable,
} from "@eclat/db";

/**
 * Phase 2: Create or reuse a Stripe PaymentIntent for an existing order.
 * Amount/currency always from persisted order. Never from client body.
 * Reuses an existing PENDING intent when present (avoids duplicate intents on retry).
 * Production fails closed without STRIPE_SECRET_KEY.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const orderId =
      typeof body.orderId === "string" ? body.orderId.trim() : "";

    if (!orderId) {
      return NextResponse.json(
        { error: "orderId is required" },
        { status: 400 }
      );
    }

    const paymentToken =
      typeof body.paymentToken === "string" ? body.paymentToken.trim() : "";
    const tokenOrderId = paymentToken
      ? await verifyOrderPaymentToken(paymentToken)
      : null;
    if (!tokenOrderId || tokenOrderId !== orderId) {
      return NextResponse.json(
        { error: "A valid checkout payment token is required" },
        { status: 401 }
      );
    }

    // Ignore any client-supplied amount/currency/status
    const order = await getOrderById(orderId);
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const paymentMethod = String((order as any).payments?.[0]?.method || "");
    if (paymentMethod !== "custom_gateway") {
      return NextResponse.json(
        { error: "This order is not configured for online card payment" },
        { status: 409 }
      );
    }

    // Stripe is not the configured Pakistan gateway. Keep production disabled
    // unless the owner explicitly enables this separate integration.
    if (
      process.env.NODE_ENV === "production" &&
      process.env.STRIPE_PAYMENTS_ENABLED !== "true"
    ) {
      return NextResponse.json(
        { error: "Stripe payments are not enabled for this store" },
        { status: 503 }
      );
    }

    const status = String((order as any).status || "");
    const paymentStatus = String((order as any).paymentStatus || "");

    if (!isOrderPayable(status, paymentStatus)) {
      if (paymentStatus === "PAID") {
        return NextResponse.json(
          { error: "Order is already paid" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Order is not payable" },
        { status: 409 }
      );
    }

    const orderTotal = Number((order as any).total);
    if (!Number.isFinite(orderTotal) || orderTotal <= 0) {
      return NextResponse.json(
        { error: "Order has invalid total" },
        { status: 400 }
      );
    }

    const currency = String((order as any).currency || "PKR").toLowerCase();
    const amountMinor = Math.round(orderTotal * 100);
    if (amountMinor < 100) {
      return NextResponse.json(
        { error: "Order amount too small" },
        { status: 400 }
      );
    }

    const secretKey = process.env.STRIPE_SECRET_KEY?.trim();

    if (!secretKey) {
      if (process.env.NODE_ENV === "production") {
        return NextResponse.json(
          { error: "Payment provider is not configured" },
          { status: 503 }
        );
      }
      return NextResponse.json({
        clientSecret: `mock_pi_${Date.now()}_secret`,
        paymentIntentId: `mock_pi_${Date.now()}`,
        amount: orderTotal,
        currency: currency.toUpperCase(),
        mock: true,
      });
    }

    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(secretKey, { apiVersion: "2024-06-20" });

    // A canceled intent cannot be reused. Use a new stable key for the next attempt.
    const existingId = await getExistingPaymentIntentId(orderId);
    const failedPayment = (order as any).payments?.find(
      (payment: any) =>
        payment.status === "FAILED" &&
        typeof payment.transactionId === "string" &&
        payment.transactionId.startsWith("pi_")
    );
    let createIdempotencyKey = failedPayment
      ? `eclat-order-payment-${orderId}-retry-${failedPayment.transactionId}`
      : `eclat-order-payment-${orderId}`;
    if (existingId) {
      try {
        const existing = await stripe.paymentIntents.retrieve(existingId);
        const reusable =
          existing.status === "requires_payment_method" ||
          existing.status === "requires_confirmation" ||
          existing.status === "requires_action";
        if (existing.status === "canceled") {
          createIdempotencyKey = `eclat-order-payment-${orderId}-retry-${existing.id}`;
        }
        const amountOk = existing.amount === amountMinor;
        const currencyOk =
          existing.currency.toLowerCase() === currency;
        if (reusable && amountOk && currencyOk && existing.client_secret) {
          return NextResponse.json({
            clientSecret: existing.client_secret,
            paymentIntentId: existing.id,
            amount: orderTotal,
            currency: currency.toUpperCase(),
            reused: true,
          });
        }
      } catch (retrieveErr) {
        console.warn("Could not reuse payment intent:", retrieveErr);
      }
    }

    const intent = await stripe.paymentIntents.create(
      {
        amount: amountMinor,
        currency,
        metadata: {
          orderId: String((order as any).id),
          orderNumber: String((order as any).orderNumber || ""),
        },
        automatic_payment_methods: { enabled: true },
      },
      {
        // A retry after a DB failure must retrieve the same Stripe intent.
        idempotencyKey: createIdempotencyKey,
      }
    );

    // Do not return a client secret unless the intent is durably linked to the order.
    // If this write fails, a retry uses the same Stripe idempotency key and can attach it.
    await attachPaymentIntent(orderId, intent.id);

    return NextResponse.json({
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
      amount: orderTotal,
      currency: currency.toUpperCase(),
    });
  } catch (e: unknown) {
    console.error("Payment intent error:", e);
    return NextResponse.json(
      { error: "Unable to create payment" },
      { status: 500 }
    );
  }
}

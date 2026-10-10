import { NextRequest, NextResponse } from "next/server";
import { getOrderById } from "@eclat/db";

/**
 * Create a Stripe PaymentIntent for an existing order.
 * Amount and currency are ALWAYS taken from the persisted order — never from the client body.
 * Production fails closed when STRIPE_SECRET_KEY is missing (no mock payment path).
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

    const order = await getOrderById(orderId);
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const status = String((order as any).status || "");
    const paymentStatus = String((order as any).paymentStatus || "");
    if (paymentStatus === "PAID") {
      return NextResponse.json(
        { error: "Order is already paid" },
        { status: 409 }
      );
    }
    if (status === "CANCELLED" || status === "REFUNDED") {
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

    const intent = await stripe.paymentIntents.create({
      amount: amountMinor,
      currency,
      metadata: {
        orderId: String((order as any).id),
        orderNumber: String((order as any).orderNumber || ""),
      },
      automatic_payment_methods: { enabled: true },
    });

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

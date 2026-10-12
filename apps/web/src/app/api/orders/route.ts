import { NextRequest, NextResponse } from "next/server";
import { getOrders, createOrder, CheckoutError } from "@eclat/db";
import { requireAdminSession } from "@eclat/auth";
import { rateLimit, RATE_LIMITS, clientKey } from "@eclat/config";
import { sendOrderConfirmation } from "@eclat/emails";

/** List all orders - admin session required. */
export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdminSession(req);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const orders = await getOrders();
    return NextResponse.json({ orders });
  } catch (e: unknown) {
    console.error(e);
    return NextResponse.json(
      { error: "Unable to load orders" },
      { status: 500 }
    );
  }
}

/** Create order - public checkout; server is authoritative for totals. */
export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";
    const rl = rateLimit({
      key: clientKey("checkout", ip),
      limit: RATE_LIMITS.checkout.limit,
      windowMs: RATE_LIMITS.checkout.windowMs,
    });
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many checkout attempts. Please try again later." },
        {
          status: 429,
          headers: rl.retryAfterMs
            ? { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) }
            : undefined,
        }
      );
    }

    const body: unknown = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { error: "Invalid checkout request" },
        { status: 400 }
      );
    }
    const checkout = body as Record<string, any>;
    const paymentMethod =
      typeof checkout.paymentMethod === "string" ? checkout.paymentMethod : "cod";
    const supportedPaymentMethods = new Set([
      "cod",
      "bank_transfer",
      "jazzcash",
      "easypaisa",
      "custom_gateway",
    ]);
    if (!supportedPaymentMethods.has(paymentMethod)) {
      return NextResponse.json(
        { error: "Selected payment method is invalid" },
        { status: 400 }
      );
    }

    // Only COD is currently wired end to end. Manual transfer and wallet
    // options must stay disabled until their instructions/provider callbacks
    // are configured and verified. Never create an order for a dead payment flow.
    if (paymentMethod !== "cod") {
      return NextResponse.json(
        {
          error: "This payment method is not available yet. Please choose Cash on Delivery.",
        },
        { status: 503 }
      );
    }

    if (
      typeof checkout.email !== "string" ||
      !checkout.email.trim() ||
      !Array.isArray(checkout.items) ||
      checkout.items.length === 0
    ) {
      return NextResponse.json(
        { error: "email and items are required" },
        { status: 400 }
      );
    }

    const order = await createOrder({
      email: checkout.email,
      phone: checkout.phone,
      shippingAddress: {
        ...(checkout.shippingAddress || {}),
        shippingMethod:
          checkout.shippingMethod ||
          checkout.shippingAddress?.shippingMethod ||
          "standard",
      },
      items: (checkout.items as any[]).map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
        variantId: i.variantId,
      })),
      paymentMethod,
      shippingMethod:
        checkout.shippingMethod || checkout.shippingAddress?.shippingMethod,
      idempotencyKey: checkout.idempotencyKey || checkout.idempotency_key || null,
    });

    try {
      await sendOrderConfirmation({
        to: checkout.email,
        orderNumber: (order as any).orderNumber,
        total: Number((order as any).total),
        paymentMethod,
      });
    } catch (emailErr) {
      console.warn("Order email skipped:", emailErr);
    }

    return NextResponse.json({ order }, { status: 201 });
  } catch (e: unknown) {
    if (e instanceof CheckoutError || (e as any)?.name === "CheckoutError") {
      const code = (e as CheckoutError).code;
      const status =
        code === "NOT_FOUND"
          ? 404
          : code === "INSUFFICIENT_STOCK"
            ? 409
            : code === "CONFLICT"
              ? 409
              : 400;
      return NextResponse.json(
        { error: (e as Error).message, code },
        { status }
      );
    }
    console.error(e);
    return NextResponse.json(
      { error: "Unable to create order" },
      { status: 500 }
    );
  }
}

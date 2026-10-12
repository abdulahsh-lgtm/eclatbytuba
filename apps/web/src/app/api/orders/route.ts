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

    const body = await req.json();
    const paymentMethod = typeof body.paymentMethod === "string" ? body.paymentMethod : "cod";
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

    if (!body.email || !body.items?.length) {
      return NextResponse.json(
        { error: "email and items are required" },
        { status: 400 }
      );
    }

    const order = await createOrder({
      email: body.email,
      phone: body.phone,
      shippingAddress: {
        ...(body.shippingAddress || {}),
        shippingMethod:
          body.shippingMethod ||
          body.shippingAddress?.shippingMethod ||
          "standard",
      },
      items: (body.items as any[]).map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
        variantId: i.variantId,
      })),
      paymentMethod,
      shippingMethod:
        body.shippingMethod || body.shippingAddress?.shippingMethod,
      idempotencyKey: body.idempotencyKey || body.idempotency_key || null,
    });

    try {
      await sendOrderConfirmation({
        to: body.email,
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

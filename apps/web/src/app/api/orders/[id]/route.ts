import { NextRequest, NextResponse } from "next/server";
import { getOrderById, updateOrderStatus, CheckoutError } from "@eclat/db";
import { requireAdminSession } from "@eclat/auth";

/** Single order - admin session required (contains customer PII). */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await requireAdminSession(req);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const order = await getOrderById(params.id);
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    return NextResponse.json({ order });
  } catch (e: unknown) {
    console.error(e);
    return NextResponse.json(
      { error: "Unable to load order" },
      { status: 500 }
    );
  }
}

/** Update order status - admin session required. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await requireAdminSession(req);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: unknown = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid order update request" }, { status: 400 });
    }
    const update = body as Record<string, unknown>;
    if (typeof update.status !== "string" || !update.status.trim()) {
      return NextResponse.json({ error: "status is required" }, { status: 400 });
    }
    if (
      (update.notes !== undefined && update.notes !== null && typeof update.notes !== "string") ||
      (update.trackingNumber !== undefined && update.trackingNumber !== null && typeof update.trackingNumber !== "string")
    ) {
      return NextResponse.json({ error: "notes and trackingNumber must be strings" }, { status: 400 });
    }
    if (
      (typeof update.notes === "string" && update.notes.length > 2000) ||
      (typeof update.trackingNumber === "string" && update.trackingNumber.length > 100)
    ) {
      return NextResponse.json({ error: "Order notes or tracking number is too long" }, { status: 400 });
    }

    const order = await updateOrderStatus(params.id, update.status, {
      notes: update.notes as string | null | undefined,
      trackingNumber: update.trackingNumber as string | null | undefined,
    });
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    return NextResponse.json({ order });
  } catch (e: unknown) {
    if (e instanceof CheckoutError || (e as any)?.name === "CheckoutError") {
      return NextResponse.json(
        { error: (e as Error).message, code: (e as CheckoutError).code },
        { status: 400 }
      );
    }
    if (
      e instanceof Error &&
      (e.message === "invalid_status" || e.message === "invalid_order_transition")
    ) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json(
      { error: "Unable to update order" },
      { status: 500 }
    );
  }
}

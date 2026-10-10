import { NextRequest, NextResponse } from "next/server";
import { getOrderById, updateOrderStatus } from "@eclat/db";

/**
 * Admin-app order update. Session is enforced by apps/admin middleware
 * (ADMIN / SUPER_ADMIN only). Prefer this path over the public web API
 * so the admin session cookie stays same-origin.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
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

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    if (!body.status) {
      return NextResponse.json({ error: "status is required" }, { status: 400 });
    }

    const order = await updateOrderStatus(params.id, body.status, {
      notes: body.notes,
      trackingNumber: body.trackingNumber,
    });
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    return NextResponse.json({ order });
  } catch (e: unknown) {
    console.error(e);
    return NextResponse.json(
      { error: "Unable to update order" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getOrderById, updateOrderStatus } from "@eclat/db";
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

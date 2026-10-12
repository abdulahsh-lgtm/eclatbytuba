/**
 * Admin order fulfillment integration test.
 * Runs route handlers against the CI PostgreSQL database with a signed admin session.
 */
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { createSessionToken } from "@eclat/auth";
import { createOrder, getOrderById, prisma } from "@eclat/db";
import { GET, PATCH } from "./route";
import { POST as createOrderRoute } from "../route";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for admin order integration tests");
}
if (process.env.ALLOW_IN_MEMORY === "1") {
  throw new Error("Admin order integration tests must not use in-memory data");
}

async function main() {
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const email = `admin_fulfillment_${suffix}@example.test`;
  let productId: string | undefined;
  let orderId: string | undefined;
  try {
    const product = await prisma.product.create({
      data: {
        name: `Admin fulfillment test ${suffix}`,
        slug: `admin-fulfillment-${suffix}`,
        price: "1200.00",
        inventory: 2,
        trackInventory: true,
        isActive: true,
        images: [],
        tags: [],
      },
    });
    productId = product.id;
    const order = await createOrder({
      email,
      shippingAddress: {
        fullName: "Admin Test",
        line1: "Test Street",
        city: "Lahore",
        postalCode: "54000",
        country: "PK",
      },
      items: [{ productId: product.id, quantity: 1 }],
      paymentMethod: "cod",
      idempotencyKey: `admin_fulfillment_${suffix}`,
    });
    orderId = String((order as any).id);

    const malformedCheckout = await createOrderRoute(
      new NextRequest("http://localhost:3000/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{",
      })
    );
    assert.equal(malformedCheckout.status, 400, "malformed checkout JSON must return 400");

    const disabledWallet = await createOrderRoute(
      new NextRequest("http://localhost:3000/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paymentMethod: "jazzcash" }),
      })
    );
    assert.equal(disabledWallet.status, 503, "unintegrated wallet methods must fail closed");

    const token = await createSessionToken({
      id: "ci-admin",
      email: "ci-admin@example.test",
      name: "CI Admin",
      role: "SUPER_ADMIN",
    });
    const url = `http://localhost:3000/api/orders/${orderId}`;
    const adminHeaders = {
      cookie: `eclat_session=${token}`,
      "content-type": "application/json",
    };

    const unauthorized = await PATCH(
      new NextRequest(url, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "CONFIRMED" }),
      }),
      { params: { id: orderId } }
    );
    assert.equal(unauthorized.status, 401, "unauthenticated fulfillment must be rejected");

    const malformed = await PATCH(
      new NextRequest(url, {
        method: "PATCH",
        headers: adminHeaders,
        body: "{",
      }),
      { params: { id: orderId } }
    );
    assert.equal(malformed.status, 400, "malformed JSON must return 400");

    const updated = await PATCH(
      new NextRequest(url, {
        method: "PATCH",
        headers: adminHeaders,
        body: JSON.stringify({
          status: "CONFIRMED",
          notes: "Packed for dispatch",
          trackingNumber: "TCS123456",
        }),
      }),
      { params: { id: orderId } }
    );
    assert.equal(updated.status, 200, "admin can confirm an order");
    const updatedBody = await updated.json();
    assert.equal(updatedBody.order.status, "CONFIRMED");
    assert.equal(updatedBody.order.notes, "Packed for dispatch");
    assert.equal(updatedBody.order.trackingNumber, "TCS123456");

    const fetched = await GET(
      new NextRequest(url, { method: "GET", headers: adminHeaders }),
      { params: { id: orderId } }
    );
    assert.equal(fetched.status, 200, "admin can read the updated order");
    const fetchedBody = await fetched.json();
    assert.equal(fetchedBody.order.status, "CONFIRMED");
    assert.equal(fetchedBody.order.trackingNumber, "TCS123456");

    const cleared = await PATCH(
      new NextRequest(url, {
        method: "PATCH",
        headers: adminHeaders,
        body: JSON.stringify({
          status: "CONFIRMED",
          notes: null,
          trackingNumber: null,
        }),
      }),
      { params: { id: orderId } }
    );
    assert.equal(cleared.status, 200, "admin can clear fulfillment fields");
    const persisted = await getOrderById(orderId);
    assert.equal((persisted as any).notes, null);
    assert.equal((persisted as any).trackingNumber, null);

    const invalidTransition = await PATCH(
      new NextRequest(url, {
        method: "PATCH",
        headers: adminHeaders,
        body: JSON.stringify({ status: "DELIVERED" }),
      }),
      { params: { id: orderId } }
    );
    assert.equal(invalidTransition.status, 400, "illegal status jumps must be rejected");

    console.log("PASS - admin fulfillment API: auth, validation, status, tracking, notes and PostgreSQL persistence");
  } finally {
    if (orderId) await prisma.order.deleteMany({ where: { id: orderId } });
    if (productId) await prisma.product.deleteMany({ where: { id: productId } });
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

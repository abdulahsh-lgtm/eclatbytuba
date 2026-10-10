/**
 * Phase 1 checkout security tests — run with:
 *   cd packages/db && ALLOW_IN_MEMORY=1 npx tsx src/checkout.security.test.ts
 *
 * Covers pure financial logic + in-memory createOrder path.
 */

import assert from "node:assert/strict";
import {
  validateEmail,
  validateQuantity,
  normalizeCheckoutItems,
  computeLineTotal,
  computeOrderTotals,
  assertFinancialInvariants,
  normalizeIdempotencyKey,
  CheckoutError,
  generateOrderNumber,
} from "./checkout";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>) {
  return (async () => {
    try {
      await fn();
      passed++;
      console.log(`PASS — ${name}`);
    } catch (e) {
      failed++;
      console.error(`FAIL — ${name}`);
      console.error(e);
    }
  })();
}

async function main() {
  await test("reject invalid email", () => {
    assert.throws(() => validateEmail(""), CheckoutError);
    assert.throws(() => validateEmail("not-an-email"), CheckoutError);
  });

  await test("accept valid email", () => {
    assert.equal(validateEmail("  A@B.co  "), "a@b.co");
  });

  await test("reject quantity 0", () => {
    assert.throws(() => validateQuantity(0), CheckoutError);
  });

  await test("reject negative quantity", () => {
    assert.throws(() => validateQuantity(-10), CheckoutError);
  });

  await test("reject decimal quantity", () => {
    assert.throws(() => validateQuantity(1.5), CheckoutError);
  });

  await test("reject huge quantity", () => {
    assert.throws(() => validateQuantity(9999), CheckoutError);
  });

  await test("line total = price × qty", () => {
    assert.equal(computeLineTotal(499, 2), 998);
  });

  await test("shipping cost server-side standard", () => {
    const t = computeOrderTotals([{ lineTotal: 1000 }], "standard");
    assert.equal(t.shippingCost, 250);
    assert.equal(t.total, 1250);
  });

  await test("shipping cost server-side express", () => {
    const t = computeOrderTotals([{ lineTotal: 1000 }], "express");
    assert.equal(t.shippingCost, 350);
    assert.equal(t.total, 1350);
  });

  await test("client shipping method unknown falls back to standard", () => {
    const t = computeOrderTotals([{ lineTotal: 100 }], "free_shipping_hack");
    assert.equal(t.shippingCost, 250);
  });

  await test("financial invariants catch mismatch", () => {
    assert.throws(
      () =>
        assertFinancialInvariants({
          subtotal: 100,
          shippingCost: 250,
          tax: 0,
          discount: 0,
          total: 1,
          items: [{ price: 100, quantity: 1, total: 100 }],
        }),
      CheckoutError
    );
  });

  await test("merge duplicate product lines", () => {
    const lines = normalizeCheckoutItems([
      { productId: "p1", quantity: 2 },
      { productId: "p1", quantity: 3 },
    ]);
    assert.equal(lines.length, 1);
    assert.equal(lines[0].quantity, 5);
  });

  await test("idempotency key validation", () => {
    assert.equal(normalizeIdempotencyKey(null), null);
    assert.throws(() => normalizeIdempotencyKey("short"), CheckoutError);
    assert.ok(normalizeIdempotencyKey("abcdefghijkl"));
  });

  await test("order numbers are unique-ish", () => {
    const a = generateOrderNumber();
    const b = generateOrderNumber();
    assert.notEqual(a, b);
    assert.ok(a.startsWith("ORD-"));
  });

  process.env.ALLOW_IN_MEMORY = "1";
  delete process.env.DATABASE_URL;
  process.env.NODE_ENV = "development";

  const { createOrder } = await import("./data");
  const { getProducts } = await import("./data");
  const products = await getProducts({ activeOnly: true });
  assert.ok(products.length > 0, "seed products required");
  const product = products[0] as {
    id: string;
    price: number;
    inventory: number;
    name: string;
  };
  const realPrice = Number(product.price);

  await test("ignores client price=1 (charges DB price)", async () => {
    const order = await createOrder({
      email: "tamper@test.com",
      shippingAddress: {
        fullName: "Test User",
        line1: "Street 1",
        city: "Lahore",
        country: "PK",
      },
      shippingMethod: "standard",
      items: [
        {
          productId: product.id,
          quantity: 1,
          price: 1,
          name: "Fake",
        },
      ],
      paymentMethod: "cod",
      idempotencyKey: `test_price_${Date.now()}`,
    });
    const line = (order as any).items[0];
    assert.equal(Number(line.price), realPrice);
    assert.notEqual(Number(line.price), 1);
    assert.equal(Number((order as any).subtotal), realPrice);
    assert.equal(Number((order as any).shippingCost), 250);
    assert.equal(Number((order as any).total), realPrice + 250);
  });

  await test("ignores client shippingCost=0", async () => {
    const order = await createOrder({
      email: "ship@test.com",
      shippingAddress: {
        fullName: "Test User",
        line1: "Street 1",
        city: "Lahore",
      },
      shippingMethod: "standard",
      shippingCost: 0 as any,
      items: [{ productId: product.id, quantity: 1 }],
      idempotencyKey: `test_ship_${Date.now()}`,
    });
    assert.equal(Number((order as any).shippingCost), 250);
  });

  await test("idempotency returns same order", async () => {
    const key = `test_idem_${Date.now()}`;
    const a = await createOrder({
      email: "idem@test.com",
      shippingAddress: {
        fullName: "Test User",
        line1: "Street 1",
        city: "Lahore",
      },
      items: [{ productId: product.id, quantity: 1 }],
      idempotencyKey: key,
    });
    const b = await createOrder({
      email: "idem@test.com",
      shippingAddress: {
        fullName: "Test User",
        line1: "Street 1",
        city: "Lahore",
      },
      items: [{ productId: product.id, quantity: 1 }],
      idempotencyKey: key,
    });
    assert.equal((a as any).id, (b as any).id);
    assert.equal((a as any).orderNumber, (b as any).orderNumber);
  });

  await test("rejects quantity larger than inventory when tracked", async () => {
    const tracked = products.find(
      (p: any) =>
        p.trackInventory !== false &&
        typeof p.inventory === "number" &&
        p.inventory >= 0 &&
        p.inventory < 20
    ) as any;
    if (!tracked) {
      const p0 = products[0] as any;
      p0.inventory = 2;
      p0.trackInventory = true;
      await assert.rejects(
        () =>
          createOrder({
            email: "stock@test.com",
            shippingAddress: {
              fullName: "Test User",
              line1: "Street 1",
              city: "Lahore",
            },
            items: [{ productId: p0.id, quantity: 3 }],
            idempotencyKey: `test_stock_${Date.now()}`,
          }),
        (err: any) =>
          err instanceof CheckoutError || err?.name === "CheckoutError"
      );
      return;
    }
    await assert.rejects(
      () =>
        createOrder({
          email: "stock@test.com",
          shippingAddress: {
            fullName: "Test User",
            line1: "Street 1",
            city: "Lahore",
          },
          items: [
            {
              productId: tracked.id,
              quantity: Number(tracked.inventory) + 1,
            },
          ],
          idempotencyKey: `test_stock_${Date.now()}`,
        }),
      (err: any) =>
        err instanceof CheckoutError || err?.name === "CheckoutError"
    );
  });

  await test("rejects unknown product", async () => {
    await assert.rejects(
      () =>
        createOrder({
          email: "x@test.com",
          shippingAddress: {
            fullName: "Test User",
            line1: "Street 1",
            city: "Lahore",
          },
          items: [{ productId: "does-not-exist-xyz", quantity: 1 }],
        }),
      (err: any) =>
        err instanceof CheckoutError || err?.name === "CheckoutError"
    );
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

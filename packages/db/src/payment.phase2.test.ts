/**
 * Phase 2 - Payment state machine & confirmation security tests.
 * Run: ALLOW_IN_MEMORY=1 npx tsx src/payment.phase2.test.ts
 */

import assert from "node:assert/strict";
import {
  canTransitionPayment,
  canMarkOrderPaid,
  canMarkPaymentFailed,
  isOrderPayable,
} from "./payment-state";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>) {
  return (async () => {
    try {
      await fn();
      passed++;
      console.log(`PASS - ${name}`);
    } catch (e) {
      failed++;
      console.error(`FAIL - ${name}`);
      console.error(e);
    }
  })();
}

async function main() {
  await test("PENDING → PAID allowed", () => {
    assert.equal(canTransitionPayment("PENDING", "PAID"), true);
  });

  await test("PENDING → FAILED allowed", () => {
    assert.equal(canTransitionPayment("PENDING", "FAILED"), true);
  });

  await test("PAID → PENDING forbidden", () => {
    assert.equal(canTransitionPayment("PAID", "PENDING"), false);
  });

  await test("PAID → PAID forbidden", () => {
    assert.equal(canTransitionPayment("PAID", "PAID"), false);
  });

  await test("REFUNDED is terminal", () => {
    assert.equal(canTransitionPayment("REFUNDED", "PAID"), false);
    assert.equal(canTransitionPayment("REFUNDED", "PENDING"), false);
  });

  await test("PAID → REFUNDED allowed", () => {
    assert.equal(canTransitionPayment("PAID", "REFUNDED"), true);
  });

  await test("FAILED → PAID allowed (retry success)", () => {
    assert.equal(canTransitionPayment("FAILED", "PAID"), true);
  });

  await test("canMarkOrderPaid rejects already PAID", () => {
    const r = canMarkOrderPaid("PENDING", "PAID");
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "already_paid");
  });

  await test("canMarkOrderPaid rejects CANCELLED", () => {
    const r = canMarkOrderPaid("CANCELLED", "PENDING");
    assert.equal(r.ok, false);
  });

  await test("canMarkOrderPaid rejects REFUNDED order", () => {
    const r = canMarkOrderPaid("REFUNDED", "PENDING");
    assert.equal(r.ok, false);
  });

  await test("canMarkOrderPaid accepts PENDING/PENDING", () => {
    const r = canMarkOrderPaid("PENDING", "PENDING");
    assert.equal(r.ok, true);
  });

  await test("canMarkOrderPaid accepts CONFIRMED/PENDING", () => {
    const r = canMarkOrderPaid("CONFIRMED", "PENDING");
    assert.equal(r.ok, true);
  });

  await test("isOrderPayable false when PAID", () => {
    assert.equal(isOrderPayable("PENDING", "PAID"), false);
  });

  await test("isOrderPayable false when CANCELLED", () => {
    assert.equal(isOrderPayable("CANCELLED", "PENDING"), false);
  });

  await test("isOrderPayable true when PENDING/PENDING", () => {
    assert.equal(isOrderPayable("PENDING", "PENDING"), true);
  });

  await test("canMarkPaymentFailed only from PENDING", () => {
    assert.equal(canMarkPaymentFailed("PENDING"), true);
    assert.equal(canMarkPaymentFailed("PAID"), false);
  });

  process.env.ALLOW_IN_MEMORY = "1";
  delete process.env.DATABASE_URL;
  process.env.NODE_ENV = "development";

  const { createOrder, confirmOrderPaid, markPaymentFailed } = await import(
    "./data"
  );
  const { getProducts } = await import("./data");
  const products = await getProducts({ activeOnly: true });
  assert.ok(products.length > 0);
  const product = products[0] as { id: string; price: number };

  await test("confirmOrderPaid marks order PAID (in-memory)", async () => {
    const order = await createOrder({
      email: "phase2@test.com",
      shippingAddress: {
        fullName: "Test",
        line1: "Street",
        city: "Lahore",
      },
      items: [{ productId: product.id, quantity: 1 }],
      paymentMethod: "card",
      idempotencyKey: `p2_paid_${Date.now()}`,
    });
    const totalMinor = Math.round(Number((order as any).total) * 100);
    const result = await confirmOrderPaid({
      orderId: (order as any).id,
      paymentIntentId: `pi_test_${Date.now()}`,
      amountMinor: totalMinor,
      currency: "pkr",
      stripeEventId: `evt_test_${Date.now()}`,
    });
    assert.equal(result.ok, true);
    assert.equal((order as any).paymentStatus, "PAID");
    assert.equal((order as any).status, "CONFIRMED");
  });

  await test("confirmOrderPaid rejects amount mismatch", async () => {
    const order = await createOrder({
      email: "phase2mismatch@test.com",
      shippingAddress: {
        fullName: "Test",
        line1: "Street",
        city: "Lahore",
      },
      items: [{ productId: product.id, quantity: 1 }],
      idempotencyKey: `p2_mismatch_${Date.now()}`,
    });
    const result = await confirmOrderPaid({
      orderId: (order as any).id,
      paymentIntentId: `pi_bad_${Date.now()}`,
      amountMinor: 1,
      currency: "pkr",
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "amount_currency_mismatch");
    assert.equal((order as any).paymentStatus, "PENDING");
  });

  await test("confirmOrderPaid is idempotent when already PAID", async () => {
    const order = await createOrder({
      email: "phase2idem@test.com",
      shippingAddress: {
        fullName: "Test",
        line1: "Street",
        city: "Lahore",
      },
      items: [{ productId: product.id, quantity: 1 }],
      idempotencyKey: `p2_idem_${Date.now()}`,
    });
    const totalMinor = Math.round(Number((order as any).total) * 100);
    const first = await confirmOrderPaid({
      orderId: (order as any).id,
      paymentIntentId: `pi_idem_${Date.now()}`,
      amountMinor: totalMinor,
      currency: "pkr",
    });
    assert.equal(first.ok, true);
    const second = await confirmOrderPaid({
      orderId: (order as any).id,
      paymentIntentId: `pi_idem_2_${Date.now()}`,
      amountMinor: totalMinor,
      currency: "pkr",
    });
    assert.equal(second.ok, true);
    if (second.ok) assert.equal(second.alreadyPaid, true);
  });

  await test("markPaymentFailed does not mark PAID orders failed", async () => {
    const order = await createOrder({
      email: "phase2fail@test.com",
      shippingAddress: {
        fullName: "Test",
        line1: "Street",
        city: "Lahore",
      },
      items: [{ productId: product.id, quantity: 1 }],
      idempotencyKey: `p2_fail_${Date.now()}`,
    });
    const totalMinor = Math.round(Number((order as any).total) * 100);
    await confirmOrderPaid({
      orderId: (order as any).id,
      paymentIntentId: `pi_ok_${Date.now()}`,
      amountMinor: totalMinor,
      currency: "pkr",
    });
    const result = await markPaymentFailed({
      orderId: (order as any).id,
      paymentIntentId: `pi_late_fail_${Date.now()}`,
    });
    assert.equal(result.ok, false);
    assert.equal((order as any).paymentStatus, "PAID");
  });

  await test("failed payment can be retried with a new PaymentIntent", async () => {
    const order = await createOrder({
      email: "phase2retry@test.com",
      shippingAddress: {
        fullName: "Test",
        line1: "Street",
        city: "Lahore",
      },
      items: [{ productId: product.id, quantity: 1 }],
      paymentMethod: "custom_gateway",
      idempotencyKey: `p2_retry_${Date.now()}`,
    });
    const oldIntentId = `pi_old_${Date.now()}`;
    const newIntentId = `pi_new_${Date.now()}`;
    const failed = await markPaymentFailed({
      orderId: (order as any).id,
      paymentIntentId: oldIntentId,
    });
    assert.equal(failed.ok, true);
    assert.equal((order as any).paymentStatus, "FAILED");

    await attachPaymentIntent((order as any).id, newIntentId);
    assert.equal((order as any).paymentStatus, "PENDING");
    assert.equal((order as any).payments[0].status, "PENDING");
    assert.equal(await getExistingPaymentIntentId((order as any).id), newIntentId);
  });

  await test("currency mismatch rejected", async () => {
    const order = await createOrder({
      email: "phase2cur@test.com",
      shippingAddress: {
        fullName: "Test",
        line1: "Street",
        city: "Lahore",
      },
      items: [{ productId: product.id, quantity: 1 }],
      idempotencyKey: `p2_cur_${Date.now()}`,
    });
    const totalMinor = Math.round(Number((order as any).total) * 100);
    const result = await confirmOrderPaid({
      orderId: (order as any).id,
      paymentIntentId: `pi_usd_${Date.now()}`,
      amountMinor: totalMinor,
      currency: "usd",
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "amount_currency_mismatch");
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

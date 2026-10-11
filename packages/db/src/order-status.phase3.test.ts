/**
 * Security Phase 3 — order status transition tests
 *   ALLOW_IN_MEMORY=1 NODE_ENV=development npx tsx src/order-status.phase3.test.ts
 */
import assert from "node:assert/strict";
import {
  canTransitionOrder,
  assertOrderStatusTransition,
  ORDER_TRANSITIONS,
} from "./payment-state";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`PASS — ${name}`);
  } catch (e) {
    failed++;
    console.error(`FAIL — ${name}`);
    console.error(e);
  }
}

test("PENDING → CONFIRMED allowed", () => {
  assert.equal(canTransitionOrder("PENDING", "CONFIRMED"), true);
});

test("PENDING → DELIVERED forbidden", () => {
  assert.equal(canTransitionOrder("PENDING", "DELIVERED"), false);
});

test("CANCELLED is terminal", () => {
  assert.equal(ORDER_TRANSITIONS.CANCELLED.size, 0);
  assert.equal(canTransitionOrder("CANCELLED", "PENDING"), false);
});

test("same status is allowed (no-op)", () => {
  assert.equal(canTransitionOrder("SHIPPED", "SHIPPED"), true);
});

test("assert rejects invalid status string", () => {
  const r = assertOrderStatusTransition("PENDING", "NOT_A_STATUS");
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, "invalid_status");
});

test("assert rejects illegal transition", () => {
  const r = assertOrderStatusTransition("PENDING", "SHIPPED");
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, "invalid_order_transition");
});

test("SHIPPED → DELIVERED allowed", () => {
  assert.equal(assertOrderStatusTransition("SHIPPED", "DELIVERED").ok, true);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);

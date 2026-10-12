/**
 * Security Phase 3 - pure helpers that admin routes rely on.
 *
 *   ALLOW_IN_MEMORY=1 NODE_ENV=development npx tsx src/admin-api.phase3.test.ts
 */
import assert from "node:assert/strict";
import { getPublicSettings, getAdminSettings, updateSettings } from "./settings-store";
import { assertOrderStatusTransition } from "./payment-state";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`PASS - ${name}`);
  } catch (e) {
    failed++;
    console.error(`FAIL - ${name}`);
    console.error(e);
  }
}

test("public settings hide jazzcash password", () => {
  const pub = getPublicSettings() as any;
  assert.equal(pub.payments.jazzcash.password, undefined);
  assert.equal(typeof pub.payments.jazzcash.enabled, "boolean");
});

test("public settings mask bank account", () => {
  const pub = getPublicSettings() as any;
  const num = pub.payments.bank.accountNumber || "";
  assert.ok(!num || num.startsWith("****") || num.length <= 4);
});

test("unintegrated payment methods remain disabled", () => {
  const pub = getPublicSettings() as any;
  assert.equal(pub.payments.bank.enabled, false);
  assert.equal(pub.payments.jazzcash.enabled, false);
  assert.equal(pub.payments.easypaisa.enabled, false);
  assert.equal(pub.payments.customGateway.enabled, false);
  assert.throws(
    () => updateSettings({ payments: { jazzcash: { enabled: true } } as any }),
    /cannot be enabled until the provider flow is integrated/
  );
});

test("admin settings object exists (must not be served without auth)", () => {
  const admin = getAdminSettings() as any;
  assert.ok(admin.payments);
  assert.ok("jazzcash" in admin.payments);
});

test("cannot jump PENDING to REFUNDED via order transition", () => {
  const r = assertOrderStatusTransition("PENDING", "REFUNDED");
  assert.equal(r.ok, false);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);

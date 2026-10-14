/**
 * PostgreSQL-backed checkout concurrency regression tests.
 * Requires DATABASE_URL and a disposable schema already created by Prisma.
 * Never run with ALLOW_IN_MEMORY=1.
 */
import assert from "node:assert/strict";
import { createOrder } from "./data";
import { prisma } from "./index";
import { getPublicSettingsPersistent, updateSettingsPersistent } from "./settings-store";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for checkout database tests");
}
if (process.env.ALLOW_IN_MEMORY === "1") {
  throw new Error("Database tests must not run with ALLOW_IN_MEMORY=1");
}

const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const emailPrefix = `checkout_db_${suffix}`;
const productIds: string[] = [];

async function createTestProduct(inventory: number) {
  const product = await prisma.product.create({
    data: {
      name: `Checkout test product ${suffix}`,
      slug: `checkout-test-${suffix}-${productIds.length}`,
      price: "1000.00",
      inventory,
      trackInventory: true,
      isActive: true,
      images: [],
      tags: [],
    },
  });
  productIds.push(product.id);
  return product;
}

function orderInput(productId: string, email: string, idempotencyKey: string) {
  return {
    email,
    shippingAddress: {
      fullName: "Checkout Test",
      line1: "Test Street",
      city: "Lahore",
      postalCode: "54000",
      country: "PK",
    },
    items: [{ productId, quantity: 1 }],
    paymentMethod: "cod",
    idempotencyKey,
  };
}

async function main() {
  const originalSetting = await prisma.setting.findUnique({ where: { key: "store" } });
  try {
    await updateSettingsPersistent({ payments: { cod: { enabled: false } } });
    const persistedSettings = await getPublicSettingsPersistent();
    assert.equal(persistedSettings.payments.cod.enabled, false);
    assert.equal(
      "password" in (persistedSettings.payments.jazzcash as any),
      false,
      "public settings must not expose wallet credentials"
    );
    console.log("PASS - store settings persist in PostgreSQL and public responses omit secrets");

    const idempotentProduct = await createTestProduct(5);
    const idempotentEmail = `${emailPrefix}_same@example.test`;
    const idempotencyKey = `same_${suffix}`;
    const [first, second] = await Promise.all([
      createOrder(orderInput(idempotentProduct.id, idempotentEmail, idempotencyKey)),
      createOrder(orderInput(idempotentProduct.id, idempotentEmail, idempotencyKey)),
    ]);
    assert.equal(first.id, second.id, "parallel retries must return the same order");
    const sameKeyOrders = await prisma.order.count({ where: { idempotencyKey } });
    assert.equal(sameKeyOrders, 1, "only one order may exist for an idempotency key");
    const idempotentInventory = await prisma.product.findUniqueOrThrow({
      where: { id: idempotentProduct.id },
    });
    assert.equal(idempotentInventory.inventory, 4, "idempotent retries decrement stock once");
    console.log("PASS - PostgreSQL concurrent duplicate checkout is idempotent");

    const stockProduct = await createTestProduct(1);
    const raceEmailA = `${emailPrefix}_race_a@example.test`;
    const raceEmailB = `${emailPrefix}_race_b@example.test`;
    const outcomes = await Promise.allSettled([
      createOrder(orderInput(stockProduct.id, raceEmailA, `race_a_${suffix}`)),
      createOrder(orderInput(stockProduct.id, raceEmailB, `race_b_${suffix}`)),
    ]);
    assert.equal(
      outcomes.filter((result) => result.status === "fulfilled").length,
      1,
      "exactly one checkout may reserve the last unit"
    );
    assert.equal(
      outcomes.filter((result) => result.status === "rejected").length,
      1,
      "the losing checkout must fail cleanly"
    );
    const finalProduct = await prisma.product.findUniqueOrThrow({
      where: { id: stockProduct.id },
    });
    assert.equal(finalProduct.inventory, 0, "inventory must never become negative");
    const raceOrders = await prisma.order.count({
      where: { email: { in: [raceEmailA, raceEmailB] } },
    });
    assert.equal(raceOrders, 1, "only the successful reservation creates an order");
    console.log("PASS - PostgreSQL concurrent inventory reservation prevents overselling");

    const cancelProduct = await createTestProduct(7);
    const cancelOrder = await createOrder(orderInput(
      cancelProduct.id,
      `${emailPrefix}_cancel@example.test`,
      `cancel_${suffix}`
    ));
    const reservedProduct = await prisma.product.findUniqueOrThrow({ where: { id: cancelProduct.id } });
    assert.equal(reservedProduct.inventory, 6, "checkout reserves one unit before cancellation");

    const { updateOrderStatus } = await import("./data");
    const [cancelA, cancelB] = await Promise.all([
      updateOrderStatus(cancelOrder.id, "CANCELLED"),
      updateOrderStatus(cancelOrder.id, "CANCELLED"),
    ]);
    assert.equal(cancelA?.status, "CANCELLED");
    assert.equal(cancelB?.status, "CANCELLED");
    const restoredProduct = await prisma.product.findUniqueOrThrow({ where: { id: cancelProduct.id } });
    assert.equal(restoredProduct.inventory, 7, "concurrent cancellation restores reserved stock exactly once");

    const cancelledOrder = await prisma.order.findUniqueOrThrow({
      where: { id: cancelOrder.id },
      include: { payments: true },
    });
    assert.equal(cancelledOrder.paymentStatus, "PENDING", "cancellation does not falsely mark payment refunded");
    assert.equal(cancelledOrder.payments[0]?.status, "PENDING", "payment status remains separate from order cancellation");
    await updateOrderStatus(cancelOrder.id, "CANCELLED");
    const afterRepeat = await prisma.product.findUniqueOrThrow({ where: { id: cancelProduct.id } });
    assert.equal(afterRepeat.inventory, 7, "repeated cancellation does not restore stock twice");
    console.log("PASS - concurrent and repeated order cancellation restores inventory exactly once");

    const paidCancelProduct = await createTestProduct(3);
    const paidCancelOrder = await createOrder(orderInput(
      paidCancelProduct.id,
      `${emailPrefix}_paid_cancel@example.test`,
      `paid_cancel_${suffix}`
    ));
    await prisma.order.update({
      where: { id: paidCancelOrder.id },
      data: { paymentStatus: "PAID", paidAt: new Date() },
    });
    await prisma.payment.updateMany({
      where: { orderId: paidCancelOrder.id },
      data: { status: "PAID" },
    });
    await updateOrderStatus(paidCancelOrder.id, "CANCELLED");
    const paidCancelled = await prisma.order.findUniqueOrThrow({
      where: { id: paidCancelOrder.id },
      include: { payments: true },
    });
    assert.equal(paidCancelled.status, "CANCELLED");
    assert.equal(paidCancelled.paymentStatus, "PAID", "cancellation must not claim a refund happened");
    assert.equal(paidCancelled.payments[0]?.status, "PAID", "provider refund confirmation remains a separate operation");
    const paidRestoredProduct = await prisma.product.findUniqueOrThrow({ where: { id: paidCancelProduct.id } });
    assert.equal(paidRestoredProduct.inventory, 3, "paid cancellation restores reserved inventory exactly once");
    console.log("PASS - paid cancellation restores stock without falsely marking payment refunded");
  } finally {
    await prisma.order.deleteMany({ where: { email: { startsWith: emailPrefix } } });
    if (productIds.length) {
      await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    }
    if (originalSetting) {
      await prisma.setting.upsert({
        where: { key: "store" },
        create: { key: "store", value: originalSetting.value as any },
        update: { value: originalSetting.value as any },
      });
    } else {
      await prisma.setting.deleteMany({ where: { key: "store" } });
    }
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

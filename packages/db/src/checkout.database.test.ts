/**
 * PostgreSQL-backed checkout concurrency regression tests.
 * Requires DATABASE_URL and a disposable schema already created by Prisma.
 * Never run with ALLOW_IN_MEMORY=1.
 */
import assert from "node:assert/strict";
import { createOrder } from "./data";
import { prisma } from "./index";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for checkout database tests");
}
if (process.env.ALLOW_IN_MEMORY === "1") {
  throw new Error("Database tests must not run with ALLOW_IN_MEMORY=1");
}

const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const emailPrefix = `checkout_db_${suffix}`;
const productIds: string[] = [];
const orderEmails: string[] = [];

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
  try {
    const idempotentProduct = await createTestProduct(5);
    const idempotentEmail = `${emailPrefix}_same@example.test`;
    orderEmails.push(idempotentEmail);
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
    orderEmails.push(raceEmailA, raceEmailB);
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
  } finally {
    await prisma.order.deleteMany({ where: { email: { startsWith: emailPrefix } } });
    if (productIds.length) {
      await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    }
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

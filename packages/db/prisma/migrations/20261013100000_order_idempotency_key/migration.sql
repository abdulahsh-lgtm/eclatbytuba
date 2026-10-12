-- Checkout Phase 3: persist request idempotency to prevent duplicate orders.
-- Requires the existing orders table to have been created by the project's database setup.
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "orders_idempotencyKey_key"
  ON "orders"("idempotencyKey");

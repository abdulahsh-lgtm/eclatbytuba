-- Phase 2 payment webhook event ledger
-- Apply with: prisma migrate deploy (when DATABASE_URL is set)
-- Safe for empty or existing environments; run via prisma migrate when ready.

-- Unique transactionId on payments (multiple NULLs allowed in PostgreSQL)
CREATE UNIQUE INDEX IF NOT EXISTS "payments_transactionId_key" ON "payments"("transactionId");

-- Stripe webhook event ledger
CREATE TABLE IF NOT EXISTS "stripe_webhook_events" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "orderId" TEXT,
    "payloadMeta" JSONB,

    CONSTRAINT "stripe_webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "stripe_webhook_events_eventId_key" ON "stripe_webhook_events"("eventId");
CREATE INDEX IF NOT EXISTS "stripe_webhook_events_type_idx" ON "stripe_webhook_events"("type");

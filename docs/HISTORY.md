# HISTORY.md — Éclat by Tuba

---

## 2026-10-13 — Fail closed for unfinished online checkout and add CI

**What**
- Hid the unfinished online card option in checkout.
- Made the orders API reject custom_gateway orders until the provider is integrated end to end, avoiding false payment instructions.
- Added a GitHub Actions workflow for Prisma schema validation, auth/checkout/payment security tests, and storefront/admin builds.

**Verification**
- Source edits pushed to the working branch.
- The workflow was just added; no run result is available yet.
- Runtime tests, builds, migrations, and deployment remain unverified. No database migration was applied.

---

## 2026-10-13 — Payment access proof and retry recovery

**What**
- Added short-lived signed checkout payment tokens bound to an order ID. The order API returns one only for custom_gateway checkout, and create-intent rejects missing or mismatched tokens.
- Restricted create-intent to orders whose stored payment method is custom_gateway.
- Kept Stripe disabled in production unless `STRIPE_PAYMENTS_ENABLED=true` is explicitly configured, since it is not the store's configured Pakistan gateway.
- Confirmed the current checkout page does not call create-intent; real Pakistan provider integration remains open and must not be reported as complete.
- Added a new stable Stripe idempotency key for canceled PaymentIntent retries.
- Added retry attachment logic for failed payment records in both database-backed and in-memory paths.
- Added source-level tests for token tampering and failed-payment retry attachment.

**Verification**
- Confirmed the changes and tests are present on the working branch through remote source review.
- Tests, typecheck, Prisma validation, build, and Stripe sandbox checks have not been run. Payment token route tests and database-backed retry tests remain required.
- No migration was applied and no deployment was performed.

---

## 2026-10-13 — Phase 3 cart and checkout audit

**What**
- Added the missing unique optional `Order.idempotencyKey` field to Prisma schema and an additive migration.
- Sent the checkout idempotency key with order requests and persisted it in session storage for safe retry after a lost response.
- Preserved selected `variantId` in checkout requests and added a regression test for keeping variant lines separate.
- Added an allowlist for supported checkout payment method values.
- Validated cart localStorage entries and capped client-side quantities to avoid malformed stored data breaking cart rendering.
- Updated PROJECT_PLAN.md and PHASES_STATUS.md with findings and future-phase checks.

**Open**
- Migration is not applied or runtime-validated. The repo still lacks a verified baseline migration path and lockfile.
- PaymentIntent ownership proof, durable payment-method settings, database-backed tests, typecheck, and builds remain open.
- No deployment or production database changes were made.

**Verification**
- Remote source review confirms the edits are present on the working branch.
- Runtime tests and build checks have not been run in this environment.

---

## 2026-10-13 — Persistent phase tracking and Phase 3 carry-forward

**What**
- Added the verification ledger, security follow-up gates, and future-phase review checklist to the existing PROJECT_PLAN.md, following the repo rule against extra plan files.
- Updated PHASES_STATUS.md to distinguish implementation reported in the repository from checks that have actually been verified.
- Recorded Phase 3 cart, checkout, order privacy, local payment, inventory, email, and admin fulfillment checks as the next product-phase audit.

**Verification**
- Confirmed the updated plan and status files are committed on the working branch.
- No runtime test/build result is implied by this documentation change. Phase 1/2 security verification remains open and deployment remains blocked.

---

## 2026-10-13 — Payment retry and webhook transaction fixes

**What**
- Added a stable Stripe idempotency key per order so retries after a database write failure reuse the same PaymentIntent.
- Stop returning a client secret when the PaymentIntent cannot be attached to the order's pending payment record.
- Move Stripe webhook ledger writes after order/payment validation and state updates, inside the same transaction, so rejected events do not get recorded as processed.
- Update the order payment status when a payment fails and make PaymentIntent attachment fail loudly when no matching payment record exists.

**Verification**
- Reviewed the updated remote source and confirmed the intended guards are present.
- Runtime tests, typecheck, Prisma validation, and build still need to run in a Node/pnpm environment with dependencies installed.

---

## 2026-10-12 — Checkout/payment verification and admin API guards

**What**
- Restored the complete historical database data layer on main and added order-status transition guards.
- Declared the Stripe SDK and auth workspace dependencies used by the existing API routes.
- Added checkout, payment, order-status, admin API, and authentication security test files, plus the combined database security test script.
- Protected admin settings reads/updates, review moderation/listing, analytics summaries, product management, and image uploads with the existing admin session helper.

**Why**
- Recovery review found the remote data layer had been truncated and admin-only settings/review operations were reachable without authentication.

**Verification**
- Confirmed changed files and commits are present on the remote main branch.
- Runtime tests, typecheck, Prisma validation, and production build remain unrun in this environment.

---


## 2026-09-28 — SEO 100 checklist: max code pass

**What**
- Image sitemap, security headers, en-PK, Organization schema
- Privacy, terms, HTML sitemap, 404 recovery
- Gallery alts + fetchPriority, HowTo helper, collection intros
- `docs/SEO_100_CHECKLIST.md` marks ✅ / 🔶 / ❌ for all 100 items

**Why**
- User asked to execute all 100; code-side done; owner-side listed

---

## 2026-09-28 — SEO/AEO hard upgrade

PDP engine, collections, guides, trust pages, sitemap, footer links.

---

## 2026-09-28 — Pakistan payments polish

COD/bank/JazzCash/EasyPaisa + customGateway; Stripe placeholder.

---

## Prior

Phases 0–8 + catalog 68.

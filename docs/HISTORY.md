# HISTORY.md — Éclat by Tuba

---

## 2026-10-14 — Cancellation inventory regression tests and CI runner fix

**What**
- Added PostgreSQL-backed regression coverage for concurrent and repeated order cancellation, stock restoration, and paid orders whose payment must remain PAID until a provider refund is confirmed.
- Updated the existing storefront integration-test script to run through the database workspace's installed `tsx` dependency. The previous script failed in CI because `tsx` was not installed in the storefront workspace.

**Verification**
- GitHub Actions run 38641693577 showed the new cancellation regression cases passing against disposable PostgreSQL.
- That run failed later, before the admin fulfillment integration test could execute, because the storefront script could not find `tsx`.
- The runner command fix is pushed for a fresh CI run. Do not mark the overall workflow verified until that run passes.
- No production database migration, merge to main, or deployment was performed.

---

## 2026-10-13 — Order update validation and CI typechecks

**What**
- Added TypeScript checks for the storefront, admin app, and database package to the existing verification workflow.
- Hardened the admin order update API: malformed JSON and invalid payload shapes return HTTP 400, notes and tracking number types and lengths are checked, and invalid status transitions return HTTP 400 rather than a server error.
- Normalized empty notes and tracking values so the admin form can clear previously saved values.

**Verification**
- The prior code state passed run 38308327307, including Prisma validation, CI database schema setup, auth and checkout/payment security tests, and both app builds.
- A fresh run for the new typecheck steps and order update validation is pending. These new changes are not marked verified until that run completes.
- No production migration, merge to main, or deployment was performed.

---

## 2026-10-13 — Phase 3 checkout request validation and CI results

**What**
- The orders API now rejects malformed JSON bodies and non-object checkout payloads with HTTP 400 instead of falling through to a generic server error.
- Removed a dead online-payment secret check that could never run after the fail-closed custom_gateway rejection.
- Updated the existing project plan and phase status ledger with verified CI results.

**Verification**
- GitHub Actions run 38307515126 succeeded on commit 94858f7c166630d6476e482bc256ef47f22d19be: Prisma validation, CI database schema setup, auth security tests, checkout/payment security tests, storefront build, and admin build all completed successfully.
- The checkout route validation change was pushed after that successful run and still requires a fresh CI run.
- Typecheck, mobile manual checkout, full admin fulfillment flow, migration baseline review, lockfile, and real payment provider tests remain open.
- No production database migration, merge to main, or deployment was performed.

---

## 2026-10-13 — Give CI builds a disposable database

**What**
- The storefront build needs a real database connection during prerendering. Updated CI to run in a container with a disposable PostgreSQL service and create its schema with Prisma before building.
- Kept the production rule that rejects localhost database URLs unchanged.

**Verification**
- Prisma validation and security suites have passed in prior CI runs.
- The updated database-backed build workflow is pending; migration history and production database migrations remain separate release gates.

---

## 2026-10-13 — Keep CI runs focused

**What**
- Added per-branch workflow concurrency so newer commits cancel redundant older verification runs and the latest code gets the available runner.

**Verification**
- Previous CI runs passed Prisma validation and security tests but the storefront build exposed a cart type error, which was fixed.
- The latest commit's verification result is pending.

---

## 2026-10-13 — Fix cart add-item type and CI build environment

**What**
- Corrected the cart context contract: the context generates each cart item's ID, so callers no longer have to supply one.
- Removed the workflow-wide development NODE_ENV so Next.js builds run in their normal production build mode.

**Verification**
- GitHub Actions identified the missing cart item ID as a storefront type error.
- A follow-up CI run is in progress for the fix. No build is marked passing until the run completes.

---

## 2026-10-13 — Fail closed for unfinished online checkout and add CI

**What**
- Hid the unfinished online card option in checkout.
- Made the orders API reject custom_gateway orders until the provider is integrated end to end, avoiding false payment instructions.
- Removed the now-unreachable payment-token response from order creation; token helpers remain covered by auth tests for a future provider integration.
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

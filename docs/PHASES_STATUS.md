# Phase Status — Éclat by Tuba

**Theme:** Soft Gloss Pastel (LOCKED) · **Font:** Plus Jakarta Sans ONLY (LOCKED)

| Phase | Name | Implementation status | Verification status |
|-------|------|------------------------|---------------------|
| 0 | Foundation + repo skeleton | Reported implemented | Runtime/build evidence not recorded here |
| 1 | DB schema + auth + admin shell | Reported implemented | Admin route security tests/build need fresh run |
| 2 | Product CRUD + media + grids | Reported implemented | CRUD, upload, mobile and regression checks need fresh run |
| 3 | Cart + checkout + orders | Audit fixes added on working branch | CI security tests, Prisma validation, storefront/admin builds pass; migration review, typecheck, route ownership tests, and end-to-end order flow pending |
| 4 | Advanced PDP + verified reviews | Reported implemented | Verified-buyer flow and PDP regression tests pending |
| 5 | Analytics + pixels | Reported implemented | Event correctness, privacy and real dashboard checks pending |
| 6 | Play element + settings | Reported implemented | Settings authorization and mobile UI checks pending |
| 7 | SEO / AEO / PWA / security / performance | Reported implemented | Crawl, schema, accessibility, security and performance evidence pending |
| 8 | Import 67 products + content + launch | Reported implemented | Catalog count, product details and build need fresh verification |

## Phase 3 audit notes

| Finding | Current status |
|---------|----------------|
| Checkout request omitted idempotency key | Fixed in working branch; tests still required |
| Prisma Order schema omitted the idempotencyKey field used by data.ts | Schema field and additive migration added on working branch; migration not applied or runtime-validated |
| Checkout request omitted selected variantId | Fixed in working branch; regression test added but not run |
| Orders API accepted arbitrary payment-method strings | Supported-method allowlist added; server-side enabled-state enforcement waits on persistent settings |
| Cart localStorage was trusted after JSON parsing | Stored cart shape/quantities now validated; UI regression test pending |
| PaymentIntent endpoint can be called using an order ID without ownership proof | Signed order-bound token added; route-level security tests still pending |
| Settings persistence is in-memory rather than durable | Open follow-up for settings phase; do not rely on enable/disable values as durable production configuration |
| Actual online payment integration | Not complete; checkout does not call create-intent and custom_gateway is only a placeholder |
| Unfinished online payment option | Hidden in checkout and rejected by orders API until provider integration is complete | 
| Automated verification | Latest run 38307515126 succeeded: Prisma validation, auth/checkout/payment tests, storefront build, admin build |

## Active security follow-up (separate from product phase numbering)

| Workstream | Status | Remaining evidence |
|------------|--------|--------------------|
| Security Phase 1: checkout and financial integrity | Implemented fixes present on working branch | CI auth/checkout/payment suites and both builds pass in run 38307515126; typecheck, DB-backed concurrency/idempotency checks, and migration validation remain open |
| Security Phase 2: payment processing and Stripe webhooks | Signed checkout token and failed/canceled retry handling added on working branch | Run auth/payment tests, DB-backed tests, Stripe test-mode success/failure/replay/mismatch cases |
| Reproducible install | Incomplete | Add/restore the correct pnpm lockfile and confirm clean install |
| Customer payment endpoint ownership | Signed token check added | Verify missing, invalid, expired, and wrong-order tokens fail closed; test custom_gateway flow end to end |
| Production readiness | Not ready | Do not deploy until all release checks pass |

Do not use a green status as proof of verification. Mark an item verified only when the command output, CI result, or manual test evidence is recorded in HISTORY.md.

## Post-plan launch work (not numbered phases)

| Item | Status |
|------|--------|
| COD + Rs 250 shipping | ✅ |
| JazzCash / EasyPaisa checkout options | ✅ (credentials placeholder in admin) |
| Generic PK payment gateway slot (admin) | ✅ |
| Stripe | Disabled placeholder only (N/A in PK) |
| Order confirmation email (Resend or mock) | ✅ |
| Catalog 68 SKUs in mem seed | ✅ |
| Real Postgres `DATABASE_URL` | 🔶 Owner sets on deploy |
| Live JazzCash/EasyPaisa API wire | 🔶 When merchant credentials ready |
| Vercel domain + GSC | 🔶 Owner deploy |

## Phase 8
- [x] Catalog pipeline from Shopify clean JSON + Kiko
- [x] `catalog-seed` + chunks + categories
- [x] Per-SKU SEO metadata (Pakistan · COD · Rs)
- [x] Shopify CDN images
- [x] Soft Gloss + verified reviews + Rs 250 shipping retained

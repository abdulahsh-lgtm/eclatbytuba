# Éclat by Tuba — Extremely Detailed Project Plan

**Version:** 2.1  
**Date locked:** 26–27 Sep 2026  
**Theme:** Soft Gloss Pastel (LOCKED)  
**Font:** Plus Jakarta Sans ONLY (LOCKED)  
**Source of truth for phases:** **this file only**  
**Product data:** catalog + approved Kiko add — never invent  
**Ops:** All Pakistan · COD · **Shipping Rs 250**

Any agent must follow these phases in order. Do not invent new phases.

---

## GLOBAL RULES (apply to every phase)

- **One font only:** Plus Jakarta Sans (400/500/600/700).
- **Theme locked:** Soft Gloss Pastel — DESIGN_TOKENS.md only.
- **Mobile-first:** FCP target < 1.2s mid-range PK mobile; admin usable on phone.
- **Surgical changes only:** Edit existing files. Do not create new style/logic files if fix fits existing code.
- **No new plan/doc sprawl:** Do **not** create extra markdown plans (`SEO_AEO_PLAN.md`, phase note files, etc.). Put **all phase detail inside this PROJECT_PLAN.md** under the relevant phase. Allowed fixed docs only: PROJECT_PLAN.md, PHASES_STATUS.md, HISTORY.md, AGENTS.md, DESIGN_TOKENS.md, PRODUCTS_CATALOG.md.
- **Log everything:** Every change → HISTORY.md.
- **No invented products** beyond catalog + owner-approved adds (Kiko).
- **Reviews:** orderId required (verified buyers only).
- **Libraries:** No heavy new libs without HISTORY justification.
- **Performance sacred.**

---

## VERIFICATION LEDGER AND CARRY-FORWARD CHECKLIST

This section is the persistent handoff record. Update it in this file instead of creating extra plan documents. A phase is not complete because code or test files exist: mark it complete only when the relevant checks have run and evidence is recorded in HISTORY.md.

### Phase naming rule
The product phases below are the numbered phases in this plan. Security remediation labels such as "security Phase 1" and "security Phase 2" are separate workstreams and must not be confused with product Phases 1 and 2.

### Current gate: payment security follow-up
- [x] Restore key checkout/payment data-layer code and add order status transition checks.
- [x] Add Stripe SDK and auth workspace dependencies used by current routes.
- [x] Add checkout, payment, order-status, admin API, and auth security test files.
- [x] Add stable Stripe PaymentIntent idempotency key and fail the request if attachment fails.
- [x] Move webhook event ledger writes into the payment transaction after validation/state updates.
- [x] Persist failed payment state on the order and reject invalid payment-record attachment.
- [x] Run checkout and payment tests in CI after dependency installation (workflow run 38307515126 succeeded).
- [ ] Add/verify tests for database transaction rollback on invalid amount/currency and duplicate webhook event.
- [ ] Verify PaymentIntent reuse, attachment failure/retry, canceled-intent retry, and payment-failure-to-success retry against the database layer.
- [ ] Run typecheck, Prisma schema/migration validation, and production builds for web/admin.
- [ ] Verify a Stripe test-mode success, failure, duplicate webhook delivery, and mismatched amount/currency.
- [ ] Resolve the missing pnpm lockfile and ensure clean, reproducible dependency installation.
- [x] Require a short-lived signed order-bound token for create-intent; issue it only for custom_gateway checkout responses.
- [ ] Run route tests proving missing, invalid, expired, and wrong-order tokens never return a client secret.
- [x] Keep the Stripe create-intent route disabled in production unless `STRIPE_PAYMENTS_ENABLED=true` is explicitly set.
- [ ] Confirm no production path enables in-memory/mock payment behavior and verify the feature flag in a production-like test.
- [ ] Do not mark security work complete until each applicable checkbox has test output or documented reason/evidence.

### Phase-by-phase carry-forward checks
Apply these checks to every phase before moving on:
- [ ] Inspect existing implementation and references before editing. Prefer the correct existing file over new files.
- [ ] Check for duplicate, placeholder, truncated, dead, or conflicting code and files. Verify references before removal or consolidation.
- [ ] Preserve unrelated work, current visual tokens, product catalog facts, existing routes, and working features.
- [ ] Add focused regression tests for each bug/security fix. Do not count test files as a passing test run.
- [ ] Check input validation, authentication/authorization, rate limits, error handling, secrets, and production fail-closed behavior where applicable.
- [ ] Check database constraints, migrations, transactions, concurrency, idempotency, and rollback behavior where applicable.
- [ ] Check loading, empty, error, success, mobile, accessibility, and keyboard states for UI work.
- [ ] Check API contract compatibility between storefront, admin, and database packages.
- [ ] Run the actual relevant tests, lint, typecheck, schema validation, and build when the environment supports them. Record blocked checks honestly.
- [ ] Update this plan's checkbox/status, PHASES_STATUS.md, and HISTORY.md with changed files, evidence, failures, and remaining work.
- [ ] Review the final diff for accidental duplicates, unrelated edits, generated artifacts, secrets, and user-facing wording.
- [ ] Never claim verified/pass without captured command output or a successful CI check.
- [ ] Keep deployment, live migrations, and production credentials last, after all release gates pass.

### Next product phase: Phase 3 — Cart + Checkout + Orders

**Audit findings and fixes on the working branch**
- [x] Added the missing optional unique `Order.idempotencyKey` field to the Prisma schema and an additive migration.
- [x] Checkout now sends a session-persisted idempotency key so a retry after a lost response can return the existing order instead of creating another.
- [x] Checkout now includes `variantId` in the order request; previously the selected variant could be lost and the base product price used.
- [x] Order API rejects unsupported payment-method values instead of persisting arbitrary strings.
- [x] Cart hydration now validates stored JSON, rejects malformed entries, handles unavailable localStorage, and caps quantities at 100 in the client cart.
- [ ] Review the migration against the actual database and resolve the missing baseline migration/history before applying it anywhere.
- [x] Add a short-lived signed checkout token bound to the order ID; create-intent rejects requests without a matching valid token and rejects orders not using custom_gateway.
- [ ] Add route-level tests for missing/invalid/expired/wrong-order tokens and confirm no client secret is returned.
- [ ] Make payment method enablement authoritative on the server after settings persistence is database-backed. Current settings storage is in-memory, so do not claim durable enable/disable behavior.
- [ ] Wire the selected Pakistan payment provider into checkout. Current checkout does not call create-intent, and custom_gateway is not a completed payment integration; never mark an order PAID without verified provider confirmation.
- [x] Hide the unfinished online payment option in checkout and reject custom_gateway orders at the API until the provider is integrated end to end.
- [x] Add GitHub Actions verification workflow for Prisma validation, auth/checkout/payment security tests, and storefront/admin builds.
- [x] Review the first database-backed GitHub Actions run; fixed the cart item ID type error and confirmed the latest workflow succeeds (run 38307515126).
- [ ] Audit duplicate order submission, inventory race conditions, order confirmation email failure, and safe retry behavior with database-backed tests.
- [ ] Audit admin order listing/status transitions and fulfillment flow end to end.
- [ ] Run checkout security tests, typecheck, Prisma validation, web/admin builds, and test the order flow on mobile.
- [ ] Record command output and manual test evidence before marking Phase 3 complete.

### Carry-forward items for later phases
- [ ] Phase 4: prove reviews require a real order for the same product and cannot be spoofed by submitting an arbitrary orderId.
- [ ] Phase 5: verify analytics values come from trusted order data, consent/privacy expectations, duplicate event handling, and no PII leakage to pixels.
- [ ] Phase 6: make settings durable in the database, enforce admin-only updates, never expose credentials in public responses, and test payment/email/play settings after refresh and across server instances.
- [ ] Phase 7: verify security headers/CSP, rate limits, accessibility, mobile layout, Core Web Vitals, sitemap/schema validity, and all product metadata from source data.
- [ ] Phase 8: verify catalog SKU count, variant inventory/pricing, product images, and every imported product against the approved catalog.
- [ ] Release gate: verify lockfile/clean install, all migrations from a clean database, tests, typecheck, builds, secret configuration, Stripe/local payment sandbox, backup/rollback plan, and staging smoke tests. Deployment remains last.

---

## PHASE 0 — Design Token Lock + Repo Skeleton + Core Docs

**Goal:** Lock visual system + monorepo foundation.

### Tasks
1. DESIGN_TOKENS.md (Soft Gloss Pastel).
2. AGENTS.md strict rules.
3. HISTORY.md seeded.
4. Turborepo + pnpm: apps/web, apps/admin, packages.
5. Root configs, .env.example.
6. Plus Jakarta Sans only.
7. Tailwind/CSS variables from tokens.
8. Soft Gloss on storefront + admin shells.

### Acceptance / DoD
Tokens locked, monorepo runs, Soft Gloss visible, no second font.

---

## PHASE 1 — DB Schema + Auth + Admin Shell

### Tasks
Prisma full schema (Review requires orderId). JWT admin auth. Mobile admin shell. Rate limit auth. Seed admin only.

### DoD
Auth on all admin routes; mobile shell; Soft Gloss on admin.

---

## PHASE 2 — Product CRUD + Media + Grids

### Tasks
Admin product CRUD, media compress, storefront Soft Gloss cards/grids, collections shell.

### DoD
CRUD + media + performant mobile grids.

---

## PHASE 3 — Cart + Checkout + Orders

### Tasks
Cart, checkout (COD + Stripe + local methods), admin orders, email mock/Resend, rate limit checkout. Shipping cost **Rs 250** sitewide fact.

### DoD
Order path works; admin can fulfill.

---

## PHASE 4 — Advanced PDP + Verified Reviews

### Tasks
Full PDP, verified reviews only, JSON-LD start.

### DoD
PDP conversion-ready; reviews need orderId.

---

## PHASE 5 — Analytics + Pixels

### Tasks
Admin analytics incl. **avg session duration**, Meta/GA4 pixels, funnel events.

### DoD
Owner sees metrics on phone; pixels ready.

---

## PHASE 6 — Play Element + Settings

### Tasks
Cherry SVG play element; admin payments + email + play config.

### DoD
Play live lightweight; settings on phone.

---

## PHASE 7 — SEO / AEO / PWA / Security / Performance

**Goal:** Rank for **all catalog products** (not only Rhode/Kiko) in organic results **and** AI Overviews where possible; PWA + security + speed.  
**Honest:** “#1 for every query” is not guaranteed — maximise probability with the checklist below.

### 7.1 Business facts (every page)
- All Pakistan delivery  
- COD  
- Shipping **Rs 250**  
- Verified reviews only  

### 7.2 Product: Kiko 3D Hydra Lipgloss (owner add)
| Field | Value |
|-------|--------|
| Name | Kiko 3D Hydra Lipgloss |
| Slug | `kiko-3d-hydra-lipgloss` |
| Price | **1499** PKR (compare 1999) |
| Shades (6) | 01 Clear, 05 Pearly Pink, 11 Golden Red, 12 Pearly Amaryllis Red, 17 Pearly Mauve, 21 Brun Rose |
| SEO title | Kiko 3D Hydra Lipgloss Pakistan \| 6 Shades \| Rs 1499 \| COD |

Wire into seed (`seed-kiko.ts` → `data.ts`). PDP: shade table, FAQ, schema, COD Rs 250.

### 7.3 SEO kit — every product
1. Unique title `{Product} Pakistan | Price | COD`  
2. Unique meta 150–160 chars + COD Rs 250  
3. Unique H1  
4. 400–800 words original description  
5. FAQ 5–8 → FAQPage schema  
6. Product + Offer schema (PKR)  
7. Review schema only if real ratings  
8. BreadcrumbList  
9. Alt text with product/shade  
10. Internal links (collection + 2 related)  
11. WebP LCP image  
12. Canonical URL  

**Priority:** P0 Rhode peptide, Kiko, Everyday Glam Kit → P1 lip sets/gloss → P2 kits/nails → P3 under 1000/2000 PKR long-tails.

### 7.4 Keywords (pattern per SKU)
`{product} pakistan` · price · COD · lahore · original · `{category} under {price}`  
Hero: rhode lip peptide pakistan, kiko 3d hydra / kiko lipgloss pakistan, lip sets, glam kit, press-on nails, etc.

### 7.5 AEO (AI Overview)
Answer-first first ~40 words; one-sentence FAQ leads; definition boxes; comparison tables; Last updated; entity name consistency; Organization clarity; Urdu+EN FAQ where demand; no thin AI spam; HowTo/ItemList schema where fit; HTML text not image-only copy; align FAQs to real PAA-style queries.

### 7.6 Technical (code tasks)
- Dynamic sitemap.xml + robots.txt  
- OG + Twitter per product  
- JSON-LD Product/Offer/FAQ/Breadcrumb/ItemList  
- noindex cart/checkout/account  
- Canonicals; 301 old Shopify URLs if any  
- CWV: LCP/CLS; preload hero only  
- PWA manifest (+ light SW optional)  
- Security headers/CSP/rate-limit audit; secrets never client-side  
- GSC submit sitemap  

### 7.7 Content pillars (min)
1. Rhode Lip Peptide Pakistan (price, COD, authenticity)  
2. Kiko 3D Hydra Pakistan (6 shades)  
3. Lip sets under 2000 PKR  
4. Everyday glam kit contents  
5. Imported makeup COD Pakistan / shipping Rs 250  

### 7.8 Off-page / traffic (execute over time)
GBP if applicable; Pinterest/TikTok exact names; micro-influencers disclose; PK blog outreach; Shorts + transcripts; email restock; digital PR; broken-link reclaim; no doorway city spam.

### 7.9 E-E-A-T / Pakistan
Real About + contact; policies linked; verified reviews with shade names; footer trust: **COD · Rs 250 · all Pakistan**; honest original/imported claims only.

### 7.10 Measurement
GSC by product query; CTR title tests; monthly AI Overview check sheet; expand FAQ from queries; HISTORY log SEO changes.

### 7.11 Extended tactic backlog (batch 2 — agents must use)

**AEO 1–25:** answer-first PDP; short FAQ leads; PAA-style FAQs; HowTo schema; ItemList hubs; entity spelling; brand+product+PK links; TL;DR; tables; no stuffing; original photos; video transcripts; Updated date; author line; only verifiable facts; topic clusters; Q&A only if substantial; speakable bullets; define jargon once; no doorway pages; one price canonical per hero; shipping structured data if possible; HTML-visible copy; fast HTML; match Overview-query phrasing.

**Technical 26–45:** self-canonicals; noindex private flows; clean pagination; fix redirects/mixed content; 301 legacy; param canonical; HSTS; preload LCP only; fetchpriority hero; lazy below-fold; small critical CSS; async pixels; CLS stability; useful 404; sitemap split later; image sitemap P0; hreflang only if real; SSR/static PDP HTML; weekly GSC coverage; fix thin crawled-not-indexed.

**On-page 46–70:** ~60 char titles; related H1; secondary H2s; SEO filenames; good alts; 1+2 keywords max; one careful brand outbound; 3–5 internal links/guide; cornerstone hubs; honest stock; owned comparisons; who-it’s-for; care sections; unique bundles; seasonal yearly; Urdu FAQ; glossary; WhatsApp→FAQ; no thin manufacturer paste; completeness > wordcount; TOC; no CLS from TOC; linkable charts; price-check dates; no duplicate thin SKUs.

**Trust 71–82:** real About; contact; policies; verified reviews; shade names in reviews; honest returns; proof for “original”; human presence; NAP if GBP; ATC trust copy; no fake timers; disclose affiliates.

**Pakistan 83–92:** Rs 250 footer strip; truthful city FAQs only; local pay methods; PKR schema; GSC Urdu queries; value-first communities; MUA lookbooks; real local mentions; courier page if true; real dispatch cutoffs.

**Off-page 93–110:** PR data stories; journalist requests; broken links; unlinked mentions; podcasts; Pinterest; no wiki spam; embeddable swatches; student discount page; non-competing cross-links; annual trends asset; Reel transcripts; helpful forums; Quora; live replay pages; courier features; tracked creators; reclaim post-migration mentions.

**Measure 111–120:** weekly GSC product filter; rank P0; low CTR → rewrite; snippet tests; bounce→answer+speed; Overview win/loss sheet; quarterly FAQ expand; prune thin fails; HISTORY SEO logs; re-crawl after PDP upgrades.

### 7.12 This-week code priority
1. Answer-first + FAQ schema P0 PDPs  
2. Sitewide COD + Rs 250 copy  
3. Sitemap + Product JSON-LD  
4. Merge Kiko into seed + variants  
5. Rhode/Kiko pillar pages or drafts  
6. GSC when domain live  

### Phase 7 Acceptance Criteria
- [ ] Kiko live @ 1499 with 6 shades in data layer  
- [ ] Shipping Rs 250 + COD + all Pakistan consistent in UI  
- [ ] sitemap.xml + robots.txt  
- [ ] Product (+ FAQ on P0) JSON-LD  
- [ ] SEO title/description used in metadata  
- [ ] PWA manifest basics  
- [ ] Security/performance audit notes in HISTORY  
- [ ] Soft Gloss + single font still enforced  
- [ ] No extra SEO plan files (all detail stays in this Phase 7 section)  

### Phase 7 Definition of Done
Technical SEO live; AEO-oriented PDP/FAQ/schema on priority SKUs; Kiko + shipping facts; PWA/security/perf acceptable; all tactics tracked only via this Phase 7 section + HISTORY.

---

## PHASE 8 — Import 67 Products + Launch

Import catalog (+ Kiko), collections, final settings, E2E COD test, launch checklist (theme, verified reviews, analytics, play, mobile admin, HISTORY).

### DoD
Full catalog purchasable; owner manages from phone.

---

## How agents must use this file

1. Read **this PROJECT_PLAN.md** before code.  
2. Work only current incomplete phase (PHASES_STATUS.md).  
3. Update PHASES_STATUS + HISTORY when done.  
4. Never change theme/font.  
5. Surgical edits.  
6. **Never add parallel plan markdown files** — extend the phase section here.

**Soft Gloss Pastel + Plus Jakarta Sans + Verified Reviews + Avg Session + Play + SEO/AEO in Phase 7 only = path forward.**

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
PDP conversion, reviews require orderId, related products.

### DoD
PDP conversion-ready; reviews need orderId.

---

## PHASE 5 — Analytics + Pixels

### Tasks
Meta/GA pixels, basic dashboard hits.

### DoD
Pixels fire; admin can see counts.

---

## PHASE 6 — Play Element + Settings

### Tasks
Email/payment settings store, play element.

### DoD
Admin settings usable; public settings secret-free.

---

## PHASE 7 — SEO / PWA / Security / Performance

### Tasks
Technical SEO, PWA, security headers, perf budget.

### DoD
Technical SEO live; performance acceptable.

---

## PHASE 8 — Import 67 Products + Launch

Import catalog (+ Kiko), collections, final settings, E2E COD test, launch checklist.

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

## SECURITY PHASE 3 — Admin API lock-down + order-status integrity

**Goal:** Close residual authorization and abuse gaps after checkout/payment Phases 1–2.

### Tasks
1. Require admin session on settings (GET ?admin=1, PUT), products POST/PUT, upload POST, reviews admin GET/PATCH, dashboard GET.
2. Enforce allow-listed order status transitions in `updateOrderStatus`.
3. Apply `RATE_LIMITS.login` on admin login.
4. Keep public settings free of raw secrets; document Stripe vs COD/JazzCash policy in PHASES_STATUS when owner decides.
5. Tests for order transitions and public settings shape.

### Status (2026-10-12)
- **Completed (code on branch):** Admin session on settings, products mutate, upload, reviews moderate/list, dashboard; login rate limit; `ORDER_TRANSITIONS` + `assertOrderStatusTransition` in payment-state; `updateOrderStatus` enforces transitions; Phase 3 unit tests.
- **Pending / external:** Commit real `pnpm-lock.yaml` via normal Git (Contents API unsafe for 141KB); apply Phase 2 migration on staging after backup; owner decision on Stripe vs PK-local payment docs.
- **Unverified here:** Multi-instance rate-limit store; Stripe test-mode E2E on staging; production builds in this environment.

### DoD
- Unauthenticated clients cannot read admin secrets, mutate catalog, upload files, moderate reviews, or read dashboard stats.
- Illegal order status transitions rejected.
- Login rate-limited.
- Focused Phase 3 tests pass; Phase 1/2 suites still pass.

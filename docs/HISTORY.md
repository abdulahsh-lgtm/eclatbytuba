# HISTORY.md — Éclat by Tuba

---

## 2026-10-12 — Security Phase 3: admin API lock-down

**What**
- Admin session required on settings (admin), products mutate, upload, reviews moderate/list, dashboard
- Order status transition table enforced in updateOrderStatus
- Admin login rate limit (RATE_LIMITS.login)
- Tests: order-status.phase3.test.ts, admin-api.phase3.test.ts
- PROJECT_PLAN: SECURITY PHASE 3 section

**Why**
- Unauthenticated admin routes could leak secrets and mutate catalog/payments

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

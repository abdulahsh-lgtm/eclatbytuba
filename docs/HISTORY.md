# HISTORY.md — Éclat by Tuba

---

## 2026-10-12 — Checkout/payment verification and admin API guards

**What**
- Restored the complete historical database data layer on main and added order-status transition guards.
- Declared the Stripe SDK dependency used by the existing payment routes.
- Added checkout, payment, order-status, and admin API security test files and a combined test script.
- Protected admin settings reads/updates and review moderation/listing routes with the existing admin session helper.

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

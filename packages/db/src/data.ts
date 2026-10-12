/**
 * Data access layer - catalog from catalog-seed (67 Shopify products + Kiko)
 * Reviews require orderId (verified buyers only).
 */

import catalogSeed from "./catalog-seed";
import {
  CheckoutError,
  validateEmail,
  normalizeCheckoutItems,
  validateShippingAddress,
  normalizeIdempotencyKey,
  computeLineTotal,
  computeOrderTotals,
  generateOrderNumber,
  assertFinancialInvariants,
} from "./checkout";

const mem = {
  categories: [] as any[],
  products: [] as any[],
  orders: [] as any[],
  reviews: [] as any[],
  initialized: false,
};

function ensureMemSeed() {
  if (mem.initialized) return;
  mem.initialized = true;
  const seed = catalogSeed as any;
  mem.categories = seed.categories.map((c: any) => ({ ...c }));
  const catById = Object.fromEntries(mem.categories.map((c: any) => [c.id, c]));
  mem.products = seed.products.map((p: any) => ({
    ...p,
    category: catById[p.categoryId] || null,
  }));
  mem.orders = [];
  mem.reviews = [];
}

function useDb(): boolean {
  const url = process.env.DATABASE_URL?.trim();
  // Next.js sets NEXT_PHASE during `next build` static generation.
  // Allow catalog seed without DATABASE_URL so the build can prerender pages.
  // Runtime production still requires a real DATABASE_URL (fail closed).
  if (process.env.NEXT_PHASE === "phase-production-build" && !url) {
    return false;
  }
  if (process.env.NODE_ENV === "production") {
    if (!url) throw new Error("DATABASE_URL is required in production.");
    if (url.includes("localhost") || url.includes("127.0.0.1"))
      throw new Error("DATABASE_URL must not point to localhost in production.");
    return true;
  }
  if (process.env.ALLOW_IN_MEMORY === "1") return false;
  if (!url) return false;
  return true;
}

function composeNotes(notes?: string | null, trackingNumber?: string | null): string | null {
  const parts: string[] = [];
  if (trackingNumber) parts.push(`TRACKING:${trackingNumber}`);
  if (notes) parts.push(notes);
  return parts.length ? parts.join("\n") : null;
}

function parseNotesField(raw?: string | null): { notes: string | null; trackingNumber: string | null } {
  if (!raw) return { notes: null, trackingNumber: null };
  const lines = raw.split("\n");
  let trackingNumber: string | null = null;
  const rest: string[] = [];
  for (const line of lines) {
    if (line.startsWith("TRACKING:")) trackingNumber = line.slice(9).trim();
    else rest.push(line);
  }
  return { notes: rest.join("\n").trim() || null, trackingNumber };
}

export async function getCategories() {
  if (useDb()) {
    const { prisma } = await import("./index");
    return prisma.category.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } });
  }
  ensureMemSeed();
  return mem.categories;
}

export async function getProducts(opts?: { categorySlug?: string; featured?: boolean; activeOnly?: boolean }) {
  const activeOnly = opts?.activeOnly !== false;
  if (useDb()) {
    const { prisma } = await import("./index");
    return prisma.product.findMany({
      where: {
        ...(activeOnly ? { isActive: true } : {}),
        ...(opts?.featured ? { isFeatured: true } : {}),
        ...(opts?.categorySlug ? { category: { slug: opts.categorySlug } } : {}),
      },
      include: { category: true },
      orderBy: { createdAt: "desc" },
    });
  }
  ensureMemSeed();
  let list = [...mem.products];
  if (activeOnly) list = list.filter((p) => p.isActive);
  if (opts?.featured) list = list.filter((p) => p.isFeatured);
  if (opts?.categorySlug) list = list.filter((p) => p.category?.slug === opts.categorySlug);
  return list;
}

export async function getProductBySlug(slug: string) {
  if (useDb()) {
    const { prisma } = await import("./index");
    return prisma.product.findUnique({ where: { slug }, include: { category: true } });
  }
  ensureMemSeed();
  return mem.products.find((p) => p.slug === slug) || null;
}

export async function getProductById(id: string) {
  if (useDb()) {
    const { prisma } = await import("./index");
    return prisma.product.findUnique({ where: { id }, include: { category: true } });
  }
  ensureMemSeed();
  return mem.products.find((p) => p.id === id) || null;
}

export async function createProduct(data: any) {
  if (useDb()) {
    const { prisma } = await import("./index");
    return prisma.product.create({ data, include: { category: true } });
  }
  ensureMemSeed();
  const product = { id: `p${Date.now()}`, ...data, category: null };
  mem.products.push(product);
  return product;
}

export async function updateProduct(id: string, data: any) {
  if (useDb()) {
    const { prisma } = await import("./index");
    return prisma.product.update({ where: { id }, data, include: { category: true } });
  }
  ensureMemSeed();
  const idx = mem.products.findIndex((p) => p.id === id);
  if (idx < 0) return null;
  mem.products[idx] = { ...mem.products[idx], ...data };
  return mem.products[idx];
}

export async function getAllProductImages() {
  const products = await getProducts({ activeOnly: false });
  const out: any[] = [];
  for (const p of products) for (const url of p.images || []) if (url) out.push({ url, productId: p.id, productName: p.name });
  return out;
}

export async function getOrders() {
  if (useDb()) {
    const { prisma } = await import("./index");
    const orders = await prisma.order.findMany({ include: { items: true, payments: true }, orderBy: { createdAt: "desc" } });
    return orders.map((o) => { const parsed = parseNotesField(o.notes); return { ...o, notes: parsed.notes, trackingNumber: parsed.trackingNumber }; });
  }
  ensureMemSeed();
  return mem.orders;
}

export async function getOrderById(id: string) {
  if (useDb()) {
    const { prisma } = await import("./index");
    const order = await prisma.order.findUnique({ where: { id }, include: { items: true, payments: true } });
    if (!order) return null;
    const parsed = parseNotesField(order.notes);
    return { ...order, notes: parsed.notes, trackingNumber: parsed.trackingNumber };
  }
  ensureMemSeed();
  return mem.orders.find((o) => o.id === id) || null;
}

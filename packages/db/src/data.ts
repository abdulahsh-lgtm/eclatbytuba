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

export async function createOrder(input: {
  email: string;
  phone?: string;
  shippingAddress: Record<string, any>;
  items: { productId: string; quantity: number; variantId?: string | null; name?: string; price?: number; imageUrl?: string }[];
  paymentMethod?: string;
  shippingCost?: number;
  shippingMethod?: string | null;
  idempotencyKey?: string | null;
  discount?: unknown;
  subtotal?: unknown;
  total?: unknown;
  orderNumber?: unknown;
}) {
  const email = validateEmail(input.email);
  const linesIn = normalizeCheckoutItems(input.items as any);
  const shippingAddress = validateShippingAddress(input.shippingAddress as any);
  const shippingMethod = (input.shippingMethod as string) || (shippingAddress.shippingMethod as string) || "standard";
  const idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey);

  if (useDb()) {
    const { prisma } = await import("./index");
    if (idempotencyKey) {
      const existing = await prisma.order.findUnique({ where: { idempotencyKey }, include: { items: true, payments: true } });
      if (existing) return existing;
    }
    return await prisma.$transaction(async (tx: any) => {
      if (idempotencyKey) {
        const existing = await tx.order.findUnique({ where: { idempotencyKey }, include: { items: true, payments: true } });
        if (existing) return existing;
      }
      const resolved: {
        productId: string;
        variantId: string | null;
        name: string;
        sku?: string | null;
        unitPrice: number;
        quantity: number;
        lineTotal: number;
        imageUrl?: string | null;
      }[] = [];
      for (const line of linesIn) {
        const product = await tx.product.findUnique({
          where: { id: line.productId },
          include: { variants: true },
        });
        if (!product || !product.isActive) {
          throw new CheckoutError("Product not found or inactive", "NOT_FOUND");
        }
        if (line.variantId) {
          const variant = await tx.productVariant.findUnique({ where: { id: line.variantId } });
          if (!variant || variant.productId !== product.id) {
            throw new CheckoutError("Invalid product variant", "VALIDATION");
          }
          if (!variant.isActive) {
            throw new CheckoutError("Variant is not available", "VALIDATION");
          }
          const unitPrice = Number(variant.price != null ? variant.price : product.price);
          if (!(unitPrice >= 0) || Number.isNaN(unitPrice)) {
            throw new CheckoutError("Invalid product price", "VALIDATION");
          }
          if (product.trackInventory && variant.inventory < line.quantity) {
            throw new CheckoutError(
              `Insufficient stock for ${product.name}`,
              "INSUFFICIENT_STOCK"
            );
          }
          if (product.trackInventory) {
            const dec = await tx.productVariant.updateMany({
              where: {
                id: variant.id,
                inventory: { gte: line.quantity },
              },
              data: { inventory: { decrement: line.quantity } },
            });
            if (dec.count !== 1) {
              throw new CheckoutError(
                `Insufficient stock for ${product.name}`,
                "INSUFFICIENT_STOCK"
              );
            }
          }
          resolved.push({
            productId: product.id,
            variantId: variant.id,
            name: `${product.name}${variant.name ? ` - ${variant.name}` : ""}`,
            sku: variant.sku || product.sku,
            unitPrice,
            quantity: line.quantity,
            lineTotal: computeLineTotal(unitPrice, line.quantity),
            imageUrl: product.images?.[0] || null,
          });
        } else {
          const unitPrice = Number(product.price);
          if (!(unitPrice >= 0)) {
            throw new CheckoutError("Invalid product price", "VALIDATION");
          }
          if (product.trackInventory && product.inventory < line.quantity) {
            throw new CheckoutError(
              `Insufficient stock for ${product.name}`,
              "INSUFFICIENT_STOCK"
            );
          }
          if (product.trackInventory) {
            const dec = await tx.product.updateMany({
              where: {
                id: product.id,
                inventory: { gte: line.quantity },
              },
              data: { inventory: { decrement: line.quantity } },
            });
            if (dec.count !== 1) {
              throw new CheckoutError(
                `Insufficient stock for ${product.name}`,
                "INSUFFICIENT_STOCK"
              );
            }
          }
          resolved.push({
            productId: product.id,
            variantId: null,
            name: product.name,
            sku: product.sku,
            unitPrice,
            quantity: line.quantity,
            lineTotal: computeLineTotal(unitPrice, line.quantity),
            imageUrl: product.images?.[0] || null,
          });
        }
      }
      const totals = computeOrderTotals(
        resolved.map((r) => ({ lineTotal: r.lineTotal })),
        shippingMethod
      );
      assertFinancialInvariants({
        subtotal: totals.subtotal,
        shippingCost: totals.shippingCost,
        tax: totals.tax,
        discount: totals.discount,
        total: totals.total,
        items: resolved.map((r) => ({
          price: r.unitPrice,
          quantity: r.quantity,
          total: r.lineTotal,
        })),
      });
      let orderNumber = generateOrderNumber();
      for (let attempt = 0; attempt < 8; attempt++) {
        try {
          return await tx.order.create({
            data: {
              orderNumber,
              email,
              phone: input.phone,
              status: "PENDING",
              paymentStatus: "PENDING",
              subtotal: totals.subtotal,
              shippingCost: totals.shippingCost,
              tax: totals.tax,
              discount: totals.discount,
              total: totals.total,
              currency: totals.currency,
              shippingAddress,
              idempotencyKey: idempotencyKey || undefined,
              items: {
                create: resolved.map((r) => ({
                  productId: r.productId,
                  variantId: r.variantId,
                  name: r.name,
                  sku: r.sku,
                  price: r.unitPrice,
                  quantity: r.quantity,
                  total: r.lineTotal,
                  imageUrl: r.imageUrl,
                })),
              },
              payments: {
                create: {
                  amount: totals.total,
                  method: input.paymentMethod || "cod",
                  status: "PENDING",
                  currency: totals.currency,
                },
              },
            },
            include: { items: true, payments: true },
          });
        } catch (err: any) {
          if (err?.code === "P2002") {
            const targets = err?.meta?.target || [];
            if (targets.includes("idempotencyKey") && idempotencyKey) {
              const existing = await tx.order.findUnique({
                where: { idempotencyKey },
                include: { items: true, payments: true },
              });
              if (existing) return existing;
            }
            if (targets.includes("orderNumber")) {
              orderNumber = generateOrderNumber();
              continue;
            }
          }
          throw err;
        }
      }
      throw new CheckoutError("Could not create order", "CONFLICT");
    });
  }

  ensureMemSeed();
  if (idempotencyKey) {
    const existing = mem.orders.find((o: any) => o.idempotencyKey === idempotencyKey);
    if (existing) return existing;
  }
  const resolvedMem: any[] = [];
  for (const line of linesIn) {
    const product = mem.products.find((p: any) => p.id === line.productId);
    if (!product || product.isActive === false) throw new CheckoutError("Product not found or inactive", "NOT_FOUND");
    const unitPrice = Number(product.price);
    if (!(unitPrice >= 0)) throw new CheckoutError("Invalid product price", "VALIDATION");
    if (product.trackInventory !== false && product.inventory < line.quantity)
      throw new CheckoutError("Insufficient stock", "INSUFFICIENT_STOCK");
    resolvedMem.push({
      productId: product.id,
      name: product.name,
      unitPrice,
      quantity: line.quantity,
      lineTotal: computeLineTotal(unitPrice, line.quantity),
    });
    if (product.trackInventory !== false) product.inventory -= line.quantity;
  }
  const totals = computeOrderTotals(resolvedMem.map((r) => ({ lineTotal: r.lineTotal })), shippingMethod);
  const order = {
    id: `o${Date.now()}`,
    orderNumber: generateOrderNumber(),
    email,
    phone: input.phone,
    status: "PENDING",
    paymentStatus: "PENDING",
    subtotal: totals.subtotal,
    shippingCost: totals.shippingCost,
    tax: totals.tax,
    discount: totals.discount,
    total: totals.total,
    currency: totals.currency,
    notes: null as string | null,
    trackingNumber: null as string | null,
    shippingAddress,
    idempotencyKey: idempotencyKey || null,
    createdAt: new Date().toISOString(),
    items: resolvedMem.map((r, idx) => ({
      id: `oi${Date.now()}${idx}`,
      productId: r.productId,
      name: r.name,
      price: r.unitPrice,
      quantity: r.quantity,
      total: r.lineTotal,
    })),
    payments: [{ id: `pay${Date.now()}`, amount: totals.total, method: input.paymentMethod || "cod", status: "PENDING" }],
  };
  assertFinancialInvariants({
    subtotal: order.subtotal,
    shippingCost: order.shippingCost,
    tax: order.tax,
    discount: order.discount,
    total: order.total,
    items: order.items,
  });
  mem.orders.unshift(order);
  return order;
}

export async function confirmOrderPaid(input: {
  orderId: string;
  paymentIntentId: string;
  amountMinor: number;
  currency: string;
  stripeEventId?: string | null;
}): Promise<{ ok: true; alreadyPaid?: boolean } | { ok: false; reason: string }> {
  if (useDb()) {
    const { confirmOrderPaidDb } = await import("./payment-confirm");
    return confirmOrderPaidDb(input);
  }
  const { canMarkOrderPaid } = await import("./payment-state");
  ensureMemSeed();
  const order = mem.orders.find((o: any) => o.id === input.orderId);
  if (!order) return { ok: false, reason: "order_not_found" };
  const gate = canMarkOrderPaid(String(order.status), String(order.paymentStatus));
  if (!gate.ok) {
    if (gate.reason === "already_paid") return { ok: true, alreadyPaid: true };
    return { ok: false, reason: gate.reason };
  }
  const orderTotalMinor = Math.round(Number(order.total) * 100);
  const orderCurrency = String(order.currency || "PKR").toLowerCase();
  if (input.amountMinor !== orderTotalMinor || input.currency.toLowerCase() !== orderCurrency)
    return { ok: false, reason: "amount_currency_mismatch" };
  order.paymentStatus = "PAID";
  if (order.status === "PENDING") order.status = "CONFIRMED";
  order.paidAt = new Date().toISOString();
  if (order.payments?.[0]) {
    order.payments[0].status = "PAID";
    order.payments[0].transactionId = input.paymentIntentId;
  }
  return { ok: true };
}

export async function markPaymentFailed(input: {
  orderId: string;
  paymentIntentId: string;
  stripeEventId?: string | null;
}): Promise<{ ok: true; skipped?: boolean } | { ok: false; reason: string }> {
  if (useDb()) {
    const { markPaymentFailedDb } = await import("./payment-confirm");
    return markPaymentFailedDb(input);
  }
  ensureMemSeed();
  const order = mem.orders.find((o: any) => o.id === input.orderId);
  if (!order) return { ok: false, reason: "order_not_found" };
  if (order.paymentStatus === "PAID") return { ok: false, reason: "already_paid" };
  if (order.payments?.[0] && order.payments[0].status === "PENDING") {
    order.payments[0].status = "FAILED";
    order.payments[0].transactionId = input.paymentIntentId;
  }
  return { ok: true };
}

export async function attachPaymentIntent(orderId: string, paymentIntentId: string): Promise<void> {
  if (useDb()) {
    const { attachPaymentIntentDb } = await import("./payment-confirm");
    return attachPaymentIntentDb(orderId, paymentIntentId);
  }
  ensureMemSeed();
  const order = mem.orders.find((o: any) => o.id === orderId);
  if (order?.payments?.[0] && order.payments[0].status === "PENDING")
    order.payments[0].transactionId = paymentIntentId;
}

export async function getExistingPaymentIntentId(orderId: string): Promise<string | null> {
  if (useDb()) {
    const { getExistingPaymentIntentIdDb } = await import("./payment-confirm");
    return getExistingPaymentIntentIdDb(orderId);
  }
  ensureMemSeed();
  const order = mem.orders.find((o: any) => o.id === orderId);
  const tid = order?.payments?.[0]?.transactionId;
  if (tid && String(tid).startsWith("pi_")) return String(tid);
  return null;
}

export async function updateOrderStatus(id: string, status: string, opts?: { notes?: string; trackingNumber?: string }) {
  if (useDb()) {
    const { prisma } = await import("./index");
    const existing = await prisma.order.findUnique({ where: { id } });
    if (!existing) return null;
    const parsed = parseNotesField(existing.notes);
    const nextNotes =
      opts?.notes !== undefined || opts?.trackingNumber !== undefined
        ? composeNotes(opts?.notes !== undefined ? opts.notes : parsed.notes, opts?.trackingNumber !== undefined ? opts.trackingNumber : parsed.trackingNumber)
        : existing.notes;
    const updated = await prisma.order.update({
      where: { id },
      data: {
        status: status as any,
        notes: nextNotes,
        ...(status === "SHIPPED" ? { shippedAt: new Date() } : {}),
        ...(status === "DELIVERED" ? { deliveredAt: new Date() } : {}),
      },
      include: { items: true, payments: true },
    });
    const out = parseNotesField(updated.notes);
    return { ...updated, notes: out.notes, trackingNumber: out.trackingNumber };
  }
  ensureMemSeed();
  const order = mem.orders.find((o) => o.id === id);
  if (!order) return null;
  order.status = status;
  if (opts?.notes !== undefined) order.notes = opts.notes;
  if (opts?.trackingNumber !== undefined) order.trackingNumber = opts.trackingNumber;
  return order;
}

export async function getProductReviews(productId: string) {
  const reviews = await getAllReviews({ approvedOnly: true });
  return reviews.filter((r: any) => r.productId === productId);
}

export async function getReviewStats(productId: string) {
  const reviews = await getProductReviews(productId);
  if (!reviews.length) return { average: 0, count: 0 };
  const sum = reviews.reduce((s: number, r: any) => s + r.rating, 0);
  return { average: sum / reviews.length, count: reviews.length };
}

export async function getAllReviews(opts?: { approvedOnly?: boolean }) {
  if (useDb()) {
    const { prisma } = await import("./index");
    return prisma.review.findMany({ where: opts?.approvedOnly ? { isApproved: true } : undefined, orderBy: { createdAt: "desc" }, include: { product: true } });
  }
  ensureMemSeed();
  let list = [...mem.reviews];
  if (opts?.approvedOnly) list = list.filter((r) => r.isApproved);
  return list;
}

export async function createReview(input: {
  productId: string;
  orderId: string;
  authorEmail: string;
  authorName?: string;
  rating: number;
  title?: string;
  body?: string;
  imageUrl?: string;
}) {
  const email = input.authorEmail.trim().toLowerCase();
  if (input.rating < 1 || input.rating > 5) throw new Error("Rating must be 1-5");

  const order = await getOrderById(input.orderId);
  if (!order) throw new Error("Order not found");
  if (String(order.email).toLowerCase() !== email) {
    throw new Error("Email does not match the order");
  }
  const eligible = ["DELIVERED", "SHIPPED", "CONFIRMED", "PROCESSING", "PAID"];
  if (!eligible.includes(String(order.status)) && String(order.paymentStatus) !== "PAID") {
    throw new Error("Order is not eligible for review yet");
  }
  const hasItem = (order.items || []).some((i: any) => i.productId === input.productId);
  if (!hasItem) throw new Error("Product was not part of this order");

  if (useDb()) {
    const { prisma } = await import("./index");
    return prisma.review.create({
      data: {
        productId: input.productId,
        orderId: input.orderId,
        authorEmail: email,
        authorName: input.authorName,
        rating: input.rating,
        title: input.title,
        body: input.body,
        imageUrl: input.imageUrl,
        isApproved: false,
      },
    });
  }
  ensureMemSeed();
  const review = {
    id: `r${Date.now()}`,
    productId: input.productId,
    orderId: input.orderId,
    authorEmail: email,
    authorName: input.authorName || null,
    rating: input.rating,
    title: input.title || null,
    body: input.body || null,
    imageUrl: input.imageUrl || null,
    isApproved: false,
    createdAt: new Date().toISOString(),
  };
  mem.reviews.unshift(review);
  return review;
}

export async function moderateReview(id: string, isApproved: boolean) {
  if (useDb()) {
    const { prisma } = await import("./index");
    return prisma.review.update({ where: { id }, data: { isApproved } });
  }
  ensureMemSeed();
  const r = mem.reviews.find((x) => x.id === id);
  if (!r) return null;
  r.isApproved = isApproved;
  return r;
}

export async function getDashboardStats() {
  const products = await getProducts({ activeOnly: false });
  const orders = await getOrders();
  const revenue = orders.reduce((s: number, o: any) => s + Number(o.total), 0);
  return {
    totalOrders: orders.length,
    revenue,
    products: products.length,
    customers: new Set(orders.map((o: any) => o.email)).size,
    recentOrders: orders.slice(0, 5),
  };
}

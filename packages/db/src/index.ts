import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export * from "@prisma/client";
export default prisma;

export {
  getCategories,
  getProducts,
  getProductBySlug,
  getProductById,
  createProduct,
  updateProduct,
  getAllProductImages,
  getOrders,
  getOrderById,
  createOrder,
  updateOrderStatus,
  getDashboardStats,
  getProductReviews,
  getReviewStats,
  getAllReviews,
  createReview,
  moderateReview,
} from "./data";

export {
  CheckoutError,
  validateEmail,
  validateQuantity,
  normalizeCheckoutItems,
  computeLineTotal,
  computeOrderTotals,
  generateOrderNumber,
  normalizeIdempotencyKey,
  assertFinancialInvariants,
} from "./checkout";

export {
  recordHit,
  getHits,
  summarizeAnalytics,
} from "./analytics-store";

export {
  getSettings,
  getPublicSettings,
  getAdminSettings,
  updateSettings,
} from "./settings-store";
export type { StoreSettings, PaymentMethodId } from "./settings-store";

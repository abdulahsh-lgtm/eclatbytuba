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

export * from "./data";
export * from "./checkout";
export {
  canTransitionPayment,
  isOrderPayable,
  canMarkOrderPaid,
  canMarkPaymentFailed,
  canTransitionOrder,
  assertOrderStatusTransition,
  PAYMENT_TRANSITIONS,
  ORDER_PAYABLE_STATUSES,
  ORDER_TRANSITIONS,
} from "./payment-state";
export type { PaymentStatusValue, OrderStatusValue } from "./payment-state";

export {
  recordHit,
  getHits,
  summarizeAnalytics,
} from "./analytics-store";

export {
  getPublicSettings,
  getAdminSettings,
  getSettings,
  updateSettings,
} from "./settings-store";
export type { StoreSettings } from "./settings-store";

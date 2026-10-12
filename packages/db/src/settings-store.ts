/**
 * Store settings — payments + email + play element
 * In-memory; Prisma Setting model when DATABASE_URL is live.
 * Secrets never returned on public GET.
 *
 * Pakistan-first payments:
 * - COD, Bank Transfer, JazzCash, EasyPaisa enabled by default
 * - Generic "customGateway" slot for any PK third-party provider (PayFast, PayPro, etc.)
 * - Stripe kept as disabled placeholder only (not available for most PK merchants)
 */

export type PaymentMethodId =
  | "cod"
  | "bank"
  | "jazzcash"
  | "easypaisa"
  | "customGateway"
  | "stripe";

export type StoreSettings = {
  payments: {
    cod: { enabled: boolean };
    bank: {
      enabled: boolean;
      accountName: string;
      accountNumber: string;
      bankName: string;
    };
    jazzcash: { enabled: boolean; merchantId: string; password: string };
    easypaisa: { enabled: boolean; storeId: string; accountNumber: string };
    /** Any Pakistan third-party gateway — connect credentials in admin later */
    customGateway: {
      enabled: boolean;
      providerName: string;
      merchantId: string;
      apiKey: string;
      webhookSecret: string;
      checkoutUrl: string;
      instructions: string;
    };
    /** Placeholder only — Stripe is not available for most Pakistan businesses */
    stripe: { enabled: boolean; publishableKey: string; secretKey: string };
  };
  email: {
    resendApiKey: string;
    fromEmail: string;
    fromName: string;
    orderConfirmation: boolean;
    shippingUpdate: boolean;
    reviewRequest: boolean;
  };
  play: {
    enabled: boolean;
    tipText: string;
  };
  pixels: {
    metaPixelId: string;
    gaId: string;
  };
};

const DEFAULTS: StoreSettings = {
  payments: {
    cod: { enabled: true },
    bank: {
      enabled: false,
      accountName: "",
      accountNumber: "",
      bankName: "",
    },
    jazzcash: { enabled: false, merchantId: "", password: "" },
    easypaisa: { enabled: false, storeId: "", accountNumber: "" },
    customGateway: {
      enabled: false,
      providerName: "",
      merchantId: "",
      apiKey: "",
      webhookSecret: "",
      checkoutUrl: "",
      instructions:
        "Pay via the linked gateway. We will confirm your order after payment.",
    },
    stripe: { enabled: false, publishableKey: "", secretKey: "" },
  },
  email: {
    resendApiKey: "",
    fromEmail: "orders@eclatbytuba.store",
    fromName: "Éclat by Tuba",
    orderConfirmation: true,
    shippingUpdate: true,
    reviewRequest: true,
  },
  play: {
    enabled: true,
    tipText: "Try the Rhode Lip Peptide set — a Lahore favourite ✨",
  },
  pixels: {
    metaPixelId: "",
    gaId: "",
  },
};

let store: StoreSettings = structuredClone(DEFAULTS);

const PAYMENT_FIELDS: Record<string, Record<string, "boolean" | "string">> = {
  cod: { enabled: "boolean" },
  bank: {
    enabled: "boolean",
    accountName: "string",
    accountNumber: "string",
    bankName: "string",
  },
  jazzcash: { enabled: "boolean", merchantId: "string", password: "string" },
  easypaisa: { enabled: "boolean", storeId: "string", accountNumber: "string" },
  customGateway: {
    enabled: "boolean",
    providerName: "string",
    merchantId: "string",
    apiKey: "string",
    webhookSecret: "string",
    checkoutUrl: "string",
    instructions: "string",
  },
  stripe: { enabled: "boolean", publishableKey: "string", secretKey: "string" },
};

function validateSettingsPatch(value: unknown): Partial<StoreSettings> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Settings payload must be an object");
  }
  const source = value as Record<string, unknown>;
  const allowedTop = new Set(["payments", "email", "play", "pixels"]);
  for (const key of Object.keys(source)) {
    if (!allowedTop.has(key)) throw new Error(`Unknown settings section: ${key}`);
  }

  const validateFields = (
    group: unknown,
    allowed: Record<string, "boolean" | "string">,
    label: string
  ) => {
    if (!group || typeof group !== "object" || Array.isArray(group)) {
      throw new Error(`${label} settings must be an object`);
    }
    for (const [key, fieldValue] of Object.entries(group)) {
      const expected = allowed[key];
      if (!expected) throw new Error(`Unknown ${label} setting: ${key}`);
      if (typeof fieldValue !== expected) {
        throw new Error(`${label}.${key} must be a ${expected}`);
      }
      if (typeof fieldValue === "string" && fieldValue.length > 5000) {
        throw new Error(`${label}.${key} is too long`);
      }
    }
  };

  if (source.payments !== undefined) {
    if (!source.payments || typeof source.payments !== "object" || Array.isArray(source.payments)) {
      throw new Error("payments settings must be an object");
    }
    for (const [method, methodSettings] of Object.entries(source.payments)) {
      const fields = PAYMENT_FIELDS[method];
      if (!fields) throw new Error(`Unknown payment method: ${method}`);
      validateFields(methodSettings, fields, `payments.${method}`);
    }
  }
  if (source.email !== undefined) {
    validateFields(source.email, {
      resendApiKey: "string",
      fromEmail: "string",
      fromName: "string",
      orderConfirmation: "boolean",
      shippingUpdate: "boolean",
      reviewRequest: "boolean",
    }, "email");
  }
  if (source.play !== undefined) {
    validateFields(source.play, { enabled: "boolean", tipText: "string" }, "play");
  }
  if (source.pixels !== undefined) {
    validateFields(source.pixels, { metaPixelId: "string", gaId: "string" }, "pixels");
  }
  return source as Partial<StoreSettings>;
}

function mergeSettings(base: StoreSettings, partial: Partial<StoreSettings>): StoreSettings {
  return {
    ...base,
    ...partial,
    payments: partial.payments
      ? {
          cod: { ...base.payments.cod, ...partial.payments.cod },
          bank: { ...base.payments.bank, ...partial.payments.bank },
          jazzcash: { ...base.payments.jazzcash, ...partial.payments.jazzcash },
          easypaisa: { ...base.payments.easypaisa, ...partial.payments.easypaisa },
          customGateway: { ...base.payments.customGateway, ...partial.payments.customGateway },
          stripe: { ...base.payments.stripe, ...partial.payments.stripe },
        }
      : base.payments,
    email: partial.email ? { ...base.email, ...partial.email } : base.email,
    play: partial.play ? { ...base.play, ...partial.play } : base.play,
    pixels: partial.pixels ? { ...base.pixels, ...partial.pixels } : base.pixels,
  };
}

function projectPublicSettings(settings: StoreSettings) {
  return {
    payments: {
      cod: { enabled: settings.payments.cod.enabled },
      bank: {
        enabled: settings.payments.bank.enabled,
        accountName: settings.payments.bank.accountName,
        bankName: settings.payments.bank.bankName,
        accountNumber: settings.payments.bank.accountNumber
          ? `****${settings.payments.bank.accountNumber.slice(-4)}`
          : "",
      },
      jazzcash: { enabled: settings.payments.jazzcash.enabled },
      easypaisa: { enabled: settings.payments.easypaisa.enabled },
      customGateway: {
        enabled: settings.payments.customGateway.enabled,
        providerName: settings.payments.customGateway.providerName || "Online payment",
        instructions: settings.payments.customGateway.instructions,
      },
      stripe: {
        enabled: settings.payments.stripe.enabled,
        publishableKey: settings.payments.stripe.publishableKey,
      },
    },
    play: settings.play,
    pixels: {
      metaPixelId: settings.pixels.metaPixelId || process.env.NEXT_PUBLIC_META_PIXEL_ID || "",
      gaId: settings.pixels.gaId || process.env.NEXT_PUBLIC_GA_ID || "",
    },
  };
}

function usePersistentSettings(): boolean {
  const url = process.env.DATABASE_URL?.trim();
  if (process.env.NODE_ENV === "production" && !url) {
    throw new Error("DATABASE_URL is required for production settings");
  }
  return process.env.ALLOW_IN_MEMORY !== "1" && Boolean(url);
}

async function loadPersistentSettings(): Promise<StoreSettings> {
  if (!usePersistentSettings()) return getSettings();
  const { prisma } = await import("./index");
  const row = await prisma.setting.findUnique({ where: { key: "store" } });
  if (!row) return structuredClone(DEFAULTS);
  return mergeSettings(structuredClone(DEFAULTS), validateSettingsPatch(row.value));
}

export function getSettings(): StoreSettings {
  return structuredClone(store);
}

/** Public-safe synchronous view for unit tests and in-memory development. */
export function getPublicSettings() {
  return projectPublicSettings(getSettings());
}

/** Admin-only synchronous view for unit tests and in-memory development. */
export function getAdminSettings(): StoreSettings {
  return getSettings();
}

export function updateSettings(partial: Partial<StoreSettings>): StoreSettings {
  store = mergeSettings(store, validateSettingsPatch(partial));
  return getSettings();
}

/** Persistent variants are used by API routes so settings survive restarts and deployments. */
export async function getPublicSettingsPersistent() {
  return projectPublicSettings(await loadPersistentSettings());
}

export async function getAdminSettingsPersistent(): Promise<StoreSettings> {
  return loadPersistentSettings();
}

export async function updateSettingsPersistent(value: unknown): Promise<StoreSettings> {
  const partial = validateSettingsPatch(value);
  const updated = mergeSettings(await loadPersistentSettings(), partial);
  if (usePersistentSettings()) {
    const { prisma } = await import("./index");
    await prisma.setting.upsert({
      where: { key: "store" },
      create: { key: "store", value: updated as any },
      update: { value: updated as any },
    });
  } else {
    store = updated;
  }
  return updated;
}

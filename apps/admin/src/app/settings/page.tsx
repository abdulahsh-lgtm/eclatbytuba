"use client";

import { useEffect, useState } from "react";

type Settings = {
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
    customGateway: {
      enabled: boolean;
      providerName: string;
      merchantId: string;
      apiKey: string;
      webhookSecret: string;
      checkoutUrl: string;
      instructions: string;
    };
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
  play: { enabled: boolean; tipText: string };
  pixels: { metaPixelId: string; gaId: string };
};

const METHOD_LABELS: Record<string, string> = {
  cod: "Cash on delivery",
  bank: "Bank transfer",
  jazzcash: "JazzCash",
  easypaisa: "EasyPaisa",
  customGateway: "Pakistan payment gateway (third-party)",
  stripe: "Card / Stripe (placeholder — usually N/A in PK)",
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  useEffect(() => {
    fetch(`${base}/api/settings?admin=1`)
      .then((r) => r.json())
      .then(setSettings)
      .catch(() => setError("Could not load settings"));
  }, [base]);

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    setMsg("");
    setError("");
    try {
      const res = await fetch(`${base}/api/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setSettings(data);
      setMsg("Saved");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (!settings) {
    return (
      <div className="p-4 text-sm text-[#6B5E62]">
        {error || "Loading settings…"}
      </div>
    );
  }

  const card =
    "rounded-[20px] border border-[#F0D6E0] bg-white p-4 shadow-[0_4px_16px_rgba(196,92,122,0.08)]";
  const label = "block text-xs font-medium text-[#6B5E62] mb-1";
  const input =
    "w-full h-10 px-3 rounded-[12px] border border-[#F0D6E0] bg-[#FFF0F5] text-sm text-[#2D2A2B] focus:outline-none focus:ring-2 focus:ring-[#C45C7A]/30";

  const paymentIds = [
    "cod",
    "bank",
    "jazzcash",
    "easypaisa",
    "customGateway",
    "stripe",
  ] as const;

  return (
    <div className="max-w-2xl space-y-4 pb-24">
      <div>
        <h1 className="text-xl font-semibold text-[#2D2A2B]">Settings</h1>
        <p className="text-sm text-[#6B5E62] mt-0.5">
          Payments (Pakistan-first), email & play — change without redeploy
        </p>
      </div>

      <section className={card}>
        <h2 className="text-sm font-semibold text-[#C45C7A] mb-1">
          Payment methods
        </h2>
        <p className="text-xs text-[#6B5E62] mb-3">
          Cash on delivery is the only active checkout method right now. Other
          payment methods stay disabled until their provider flow is integrated and tested.
        </p>
        <div className="space-y-3">
          {paymentIds.map((id) => (
            <label
              key={id}
              className="flex items-center gap-2 text-sm text-[#2D2A2B]"
            >
              <input
                type="checkbox"
                disabled={id !== "cod"}
                checked={(settings.payments as any)[id]?.enabled ?? false}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    payments: {
                      ...settings.payments,
                      [id]: {
                        ...(settings.payments as any)[id],
                        enabled: e.target.checked,
                      },
                    },
                  })
                }
                className="accent-[#C45C7A]"
              />
              <span className="font-medium">{METHOD_LABELS[id] || id}</span>
            </label>
          ))}
        </div>

        {settings.payments.bank.enabled && (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div>
              <label className={label}>Bank name</label>
              <input
                className={input}
                value={settings.payments.bank.bankName}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    payments: {
                      ...settings.payments,
                      bank: {
                        ...settings.payments.bank,
                        bankName: e.target.value,
                      },
                    },
                  })
                }
              />
            </div>
            <div>
              <label className={label}>Account name</label>
              <input
                className={input}
                value={settings.payments.bank.accountName}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    payments: {
                      ...settings.payments,
                      bank: {
                        ...settings.payments.bank,
                        accountName: e.target.value,
                      },
                    },
                  })
                }
              />
            </div>
            <div className="sm:col-span-2">
              <label className={label}>Account number</label>
              <input
                className={input}
                value={settings.payments.bank.accountNumber}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    payments: {
                      ...settings.payments,
                      bank: {
                        ...settings.payments.bank,
                        accountNumber: e.target.value,
                      },
                    },
                  })
                }
              />
            </div>
          </div>
        )}

        {settings.payments.jazzcash.enabled && (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div>
              <label className={label}>JazzCash merchant ID (placeholder)</label>
              <input
                className={input}
                value={settings.payments.jazzcash.merchantId}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    payments: {
                      ...settings.payments,
                      jazzcash: {
                        ...settings.payments.jazzcash,
                        merchantId: e.target.value,
                      },
                    },
                  })
                }
                placeholder="Connect when API credentials are ready"
              />
            </div>
            <div>
              <label className={label}>JazzCash password</label>
              <input
                type="password"
                className={input}
                value={settings.payments.jazzcash.password}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    payments: {
                      ...settings.payments,
                      jazzcash: {
                        ...settings.payments.jazzcash,
                        password: e.target.value,
                      },
                    },
                  })
                }
              />
            </div>
          </div>
        )}

        {settings.payments.easypaisa.enabled && (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div>
              <label className={label}>EasyPaisa store ID (placeholder)</label>
              <input
                className={input}
                value={settings.payments.easypaisa.storeId}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    payments: {
                      ...settings.payments,
                      easypaisa: {
                        ...settings.payments.easypaisa,
                        storeId: e.target.value,
                      },
                    },
                  })
                }
                placeholder="Connect when API credentials are ready"
              />
            </div>
            <div>
              <label className={label}>Account number</label>
              <input
                className={input}
                value={settings.payments.easypaisa.accountNumber}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    payments: {
                      ...settings.payments,
                      easypaisa: {
                        ...settings.payments.easypaisa,
                        accountNumber: e.target.value,
                      },
                    },
                  })
                }
              />
            </div>
          </div>
        )}

        {settings.payments.customGateway.enabled && (
          <div className="mt-3 space-y-2 rounded-[12px] border border-dashed border-[#C45C7A]/40 bg-[#FFF0F5]/50 p-3">
            <p className="text-xs text-[#6B5E62]">
              Third-party Pakistan provider (e.g. PayFast, PayPro, or your
              bank’s payment gateway). Fill credentials when you have them —
              checkout already shows this method when enabled.
            </p>
            <div>
              <label className={label}>Provider display name</label>
              <input
                className={input}
                value={settings.payments.customGateway.providerName}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    payments: {
                      ...settings.payments,
                      customGateway: {
                        ...settings.payments.customGateway,
                        providerName: e.target.value,
                      },
                    },
                  })
                }
                placeholder="e.g. PayFast Pakistan"
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              <div>
                <label className={label}>Merchant ID</label>
                <input
                  className={input}
                  value={settings.payments.customGateway.merchantId}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      payments: {
                        ...settings.payments,
                        customGateway: {
                          ...settings.payments.customGateway,
                          merchantId: e.target.value,
                        },
                      },
                    })
                  }
                />
              </div>
              <div>
                <label className={label}>API key</label>
                <input
                  type="password"
                  className={input}
                  value={settings.payments.customGateway.apiKey}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      payments: {
                        ...settings.payments,
                        customGateway: {
                          ...settings.payments.customGateway,
                          apiKey: e.target.value,
                        },
                      },
                    })
                  }
                />
              </div>
            </div>
            <div>
              <label className={label}>Checkout / redirect URL (optional)</label>
              <input
                className={input}
                value={settings.payments.customGateway.checkoutUrl}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    payments: {
                      ...settings.payments,
                      customGateway: {
                        ...settings.payments.customGateway,
                        checkoutUrl: e.target.value,
                      },
                    },
                  })
                }
                placeholder="https://…"
              />
            </div>
            <div>
              <label className={label}>Webhook secret (optional)</label>
              <input
                type="password"
                className={input}
                value={settings.payments.customGateway.webhookSecret}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    payments: {
                      ...settings.payments,
                      customGateway: {
                        ...settings.payments.customGateway,
                        webhookSecret: e.target.value,
                      },
                    },
                  })
                }
              />
            </div>
            <div>
              <label className={label}>Checkout hint text</label>
              <input
                className={input}
                value={settings.payments.customGateway.instructions}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    payments: {
                      ...settings.payments,
                      customGateway: {
                        ...settings.payments.customGateway,
                        instructions: e.target.value,
                      },
                    },
                  })
                }
              />
            </div>
          </div>
        )}

        {settings.payments.stripe.enabled && (
          <div className="mt-3 grid gap-2">
            <p className="text-xs text-amber-700">
              Stripe is not available for most Pakistan merchants. Keep disabled
              unless you have an approved international account.
            </p>
            <div>
              <label className={label}>Stripe publishable key</label>
              <input
                className={input}
                value={settings.payments.stripe.publishableKey}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    payments: {
                      ...settings.payments,
                      stripe: {
                        ...settings.payments.stripe,
                        publishableKey: e.target.value,
                      },
                    },
                  })
                }
              />
            </div>
            <div>
              <label className={label}>Stripe secret key</label>
              <input
                type="password"
                className={input}
                value={settings.payments.stripe.secretKey}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    payments: {
                      ...settings.payments,
                      stripe: {
                        ...settings.payments.stripe,
                        secretKey: e.target.value,
                      },
                    },
                  })
                }
              />
            </div>
          </div>
        )}
      </section>

      <section className={card}>
        <h2 className="text-sm font-semibold text-[#C45C7A] mb-3">
          Email (Resend)
        </h2>
        <div className="space-y-2">
          <div>
            <label className={label}>API key</label>
            <input
              type="password"
              className={input}
              value={settings.email.resendApiKey}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  email: { ...settings.email, resendApiKey: e.target.value },
                })
              }
              placeholder="re_… or leave empty for mock"
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            <div>
              <label className={label}>From email</label>
              <input
                className={input}
                value={settings.email.fromEmail}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    email: { ...settings.email, fromEmail: e.target.value },
                  })
                }
              />
            </div>
            <div>
              <label className={label}>From name</label>
              <input
                className={input}
                value={settings.email.fromName}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    email: { ...settings.email, fromName: e.target.value },
                  })
                }
              />
            </div>
          </div>
          {(["orderConfirmation", "shippingUpdate", "reviewRequest"] as const).map(
            (k) => (
              <label
                key={k}
                className="flex items-center gap-2 text-sm text-[#2D2A2B]"
              >
                <input
                  type="checkbox"
                  checked={settings.email[k]}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      email: { ...settings.email, [k]: e.target.checked },
                    })
                  }
                  className="accent-[#C45C7A]"
                />
                {k === "orderConfirmation"
                  ? "Order confirmation"
                  : k === "shippingUpdate"
                    ? "Shipping updates"
                    : "Review request emails"}
              </label>
            )
          )}
        </div>
      </section>

      <section className={card}>
        <h2 className="text-sm font-semibold text-[#C45C7A] mb-3">
          Play element
        </h2>
        <label className="flex items-center gap-2 text-sm text-[#2D2A2B] mb-2">
          <input
            type="checkbox"
            checked={settings.play.enabled}
            onChange={(e) =>
              setSettings({
                ...settings,
                play: { ...settings.play, enabled: e.target.checked },
              })
            }
            className="accent-[#C45C7A]"
          />
          Show cherry tip on storefront
        </label>
        <div>
          <label className={label}>Default tip text</label>
          <input
            className={input}
            value={settings.play.tipText}
            onChange={(e) =>
              setSettings({
                ...settings,
                play: { ...settings.play, tipText: e.target.value },
              })
            }
          />
        </div>
      </section>

      <section className={card}>
        <h2 className="text-sm font-semibold text-[#C45C7A] mb-3">
          Pixels (optional override)
        </h2>
        <p className="text-xs text-[#6B5E62] mb-2">
          Env vars NEXT_PUBLIC_META_PIXEL_ID / NEXT_PUBLIC_GA_ID still work if
          these are empty.
        </p>
        <div className="grid gap-2">
          <div>
            <label className={label}>Meta Pixel ID</label>
            <input
              className={input}
              value={settings.pixels.metaPixelId}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  pixels: { ...settings.pixels, metaPixelId: e.target.value },
                })
              }
            />
          </div>
          <div>
            <label className={label}>GA4 Measurement ID</label>
            <input
              className={input}
              value={settings.pixels.gaId}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  pixels: { ...settings.pixels, gaId: e.target.value },
                })
              }
            />
          </div>
        </div>
      </section>

      <div className="fixed bottom-0 left-0 right-0 md:left-64 border-t border-[#F0D6E0] bg-white p-3 z-20">
        <div className="max-w-2xl flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="h-10 px-5 rounded-[12px] bg-[#C45C7A] text-white text-sm font-semibold disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save settings"}
          </button>
          {msg && <span className="text-sm text-green-700">{msg}</span>}
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>
      </div>
    </div>
  );
}

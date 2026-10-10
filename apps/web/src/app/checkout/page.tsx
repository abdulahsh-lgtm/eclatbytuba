"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, Input } from "@eclat/ui";
import { useCart } from "@/context/CartContext";
import { trackEvent } from "@/components/AnalyticsBeacon";

const ALL_PAYMENTS = [
  {
    value: "cod",
    key: "cod" as const,
    label: "Cash on Delivery",
    hint: "Pay when you receive your order",
  },
  {
    value: "bank_transfer",
    key: "bank" as const,
    label: "Bank Transfer",
    hint: "We'll send account details after order",
  },
  {
    value: "jazzcash",
    key: "jazzcash" as const,
    label: "JazzCash",
    hint: "Mobile wallet — payment instructions after order",
  },
  {
    value: "easypaisa",
    key: "easypaisa" as const,
    label: "EasyPaisa",
    hint: "Mobile wallet — payment instructions after order",
  },
  {
    value: "custom_gateway",
    key: "customGateway" as const,
    label: "Online payment",
    hint: "Pay via our Pakistan payment partner",
  },
];

/** Sitewide fact: standard shipping Rs 250 all Pakistan */
const SHIPPING_OPTIONS = [
  { value: "standard", label: "Standard (3–5 days) · All Pakistan", cost: 250 },
  { value: "express", label: "Express (1–2 days)", cost: 350 },
] as const;

function thankYouMessage(method: string, gatewayName?: string) {
  switch (method) {
    case "cod":
      return "We'll contact you shortly to confirm. Pay on delivery. Shipping Rs 250.";
    case "bank_transfer":
      return "We'll WhatsApp/email bank details shortly. Order ships after payment confirmation.";
    case "jazzcash":
      return "We'll send JazzCash payment instructions shortly. Order ships after payment confirmation.";
    case "easypaisa":
      return "We'll send EasyPaisa payment instructions shortly. Order ships after payment confirmation.";
    case "custom_gateway":
      return gatewayName
        ? `Complete payment via ${gatewayName}. We'll confirm once payment is received.`
        : "Complete payment via our online gateway. We'll confirm once payment is received.";
    default:
      return "We'll send payment instructions shortly.";
  }
}

export default function CheckoutPage() {
  const { items, subtotal, clearCart } = useCart();
  const [placed, setPlaced] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [shippingMethod, setShippingMethod] = useState("standard");
  const [enabledKeys, setEnabledKeys] = useState<string[]>(["cod"]);
  const [bankHint, setBankHint] = useState("");
  const [gatewayLabel, setGatewayLabel] = useState("Online payment");
  const [gatewayHint, setGatewayHint] = useState(
    "Pay via our Pakistan payment partner"
  );
  const [form, setForm] = useState({
    email: "",
    fullName: "",
    phone: "",
    address: "",
    city: "",
    postalCode: "",
  });

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((s) => {
        const p = s?.payments || {};
        const keys = ALL_PAYMENTS.filter(
          (opt) =>
            p[opt.key]?.enabled === true ||
            (opt.key === "cod" && p.cod?.enabled !== false)
        ).map((opt) => opt.key);
        const list = keys.length ? keys : ["cod"];
        setEnabledKeys(list);
        const first = ALL_PAYMENTS.find((o) => list.includes(o.key));
        if (first) setPaymentMethod(first.value);
        if (p.bank?.enabled && p.bank.bankName) {
          setBankHint(
            `${p.bank.bankName} · ${p.bank.accountName} · ${p.bank.accountNumber}`
          );
        }
        if (p.customGateway?.enabled) {
          setGatewayLabel(p.customGateway.providerName || "Online payment");
          setGatewayHint(
            p.customGateway.instructions ||
              "Pay via our Pakistan payment partner"
          );
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (items.length > 0) {
      trackEvent("begin_checkout", { itemCount: items.length, value: subtotal });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const paymentOptions = ALL_PAYMENTS.filter((o) =>
    enabledKeys.includes(o.key)
  ).map((o) => {
    if (o.key === "bank" && bankHint) return { ...o, hint: bankHint };
    if (o.key === "customGateway")
      return { ...o, label: gatewayLabel, hint: gatewayHint };
    return o;
  });

  const shippingCost =
    SHIPPING_OPTIONS.find((s) => s.value === shippingMethod)?.cost ?? 250;
  const total = subtotal + shippingCost;

  if (items.length === 0 && !placed) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h1 className="text-3xl font-semibold text-[#2D2A2B]">Checkout</h1>
        <p className="mt-4 text-[#6B5E62]">Your cart is empty.</p>
        <Link href="/products" className="mt-8 inline-block">
          <Button>Continue Shopping</Button>
        </Link>
      </main>
    );
  }

  if (placed) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h1 className="text-3xl font-semibold text-[#2D2A2B]">Thank you</h1>
        <p className="mt-4 text-[#6B5E62]">
          Your order{" "}
          <strong className="text-[#2D2A2B]">{orderNumber}</strong> has been
          placed.
        </p>
        <p className="mt-2 text-sm text-[#6B5E62]">
          {thankYouMessage(paymentMethod, gatewayLabel)}
        </p>
        <Link href="/products" className="mt-8 inline-block">
          <Button>Continue Shopping</Button>
        </Link>
      </main>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Server is authoritative for price, shipping, and totals.
      const idempotencyKey =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID().replace(/-/g, "")
          : `ck_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email,
          phone: form.phone,
          paymentMethod,
          shippingMethod,
          idempotencyKey,
          shippingAddress: {
            fullName: form.fullName,
            line1: form.address,
            city: form.city,
            postalCode: form.postalCode,
            country: "PK",
            shippingMethod,
          },
          items: items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            variantId: (i as any).variantId,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to place order");

      trackEvent("purchase", {
        orderId: data.order.id,
        orderNumber: data.order.orderNumber,
        value: total,
        paymentMethod,
      });

      setOrderNumber(data.order.orderNumber);
      clearCart();
      setPlaced(true);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const radioClass =
    "flex cursor-pointer items-center gap-3 rounded-[16px] border border-[#F0D6E0] p-3 hover:bg-[#FFF0F5]";

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-3xl font-semibold text-[#2D2A2B]">Checkout</h1>
      <p className="mt-1 text-sm text-[#6B5E62]">
        COD available · Shipping from Rs 250 · All Pakistan
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-10 grid grid-cols-1 gap-12 lg:grid-cols-2"
      >
        <div className="space-y-6">
          <h2 className="text-lg font-medium text-[#2D2A2B]">
            Contact & Shipping (Pakistan)
          </h2>
          <Input
            placeholder="Email"
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <Input
            placeholder="Full Name"
            required
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          />
          <Input
            placeholder="Phone (03XX…)"
            required
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <Input
            placeholder="Address"
            required
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              placeholder="City"
              required
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
            />
            <Input
              placeholder="Postal Code"
              value={form.postalCode}
              onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
            />
          </div>

          <div>
            <h3 className="mb-3 text-sm font-medium text-[#2D2A2B]">Shipping</h3>
            <div className="space-y-2">
              {SHIPPING_OPTIONS.map((opt) => (
                <label key={opt.value} className={radioClass}>
                  <input
                    type="radio"
                    name="shipping"
                    value={opt.value}
                    checked={shippingMethod === opt.value}
                    onChange={() => setShippingMethod(opt.value)}
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[#2D2A2B]">
                      {opt.label}
                    </p>
                    <p className="text-xs text-[#6B5E62]">PKR {opt.cost}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-medium text-[#2D2A2B]">
              Payment Method
            </h3>
            <div className="space-y-2">
              {paymentOptions.map((opt) => (
                <label key={opt.value} className={radioClass}>
                  <input
                    type="radio"
                    name="payment"
                    value={opt.value}
                    checked={paymentMethod === opt.value}
                    onChange={() => setPaymentMethod(opt.value)}
                  />
                  <div>
                    <p className="text-sm font-medium text-[#2D2A2B]">
                      {opt.label}
                    </p>
                    <p className="text-xs text-[#6B5E62]">{opt.hint}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-medium text-[#2D2A2B]">Order Summary</h2>
          <div
            className="mt-6 space-y-4 rounded-[24px] border border-[#F0D6E0] bg-white p-6"
            style={{
              boxShadow:
                "0 4px 20px rgba(196, 92, 122, 0.08), 0 1px 3px rgba(196, 92, 122, 0.04)",
            }}
          >
            {items.map((item) => (
              <div
                key={item.id}
                className="flex justify-between text-sm text-[#2D2A2B]"
              >
                <span>
                  {item.name} × {item.quantity}
                </span>
                <span>PKR {(item.price * item.quantity).toLocaleString()}</span>
              </div>
            ))}
            <div className="space-y-2 border-t border-[#F0D6E0] pt-4 text-sm">
              <div className="flex justify-between text-[#6B5E62]">
                <span>Subtotal</span>
                <span>PKR {subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-[#6B5E62]">
                <span>Shipping</span>
                <span>PKR {shippingCost.toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-semibold text-[#2D2A2B]">
                <span>Total</span>
                <span>PKR {total.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {error && <p className="mt-4 text-sm text-[#C45C5C]">{error}</p>}

          <Button type="submit" size="lg" className="mt-6 w-full" disabled={loading}>
            {loading ? "Placing Order..." : "Place Order"}
          </Button>
        </div>
      </form>
    </main>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@eclat/ui";

const STATUSES = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
];

export function OrderStatusForm({
  orderId,
  currentStatus,
  initialNotes,
  initialTracking,
}: {
  orderId: string;
  currentStatus: string;
  initialNotes?: string | null;
  initialTracking?: string | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [notes, setNotes] = useState(initialNotes || "");
  const [trackingNumber, setTrackingNumber] = useState(initialTracking || "");
  const [loading, setLoading] = useState(false);

  const handleUpdate = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          status,
          notes: notes || null,
          trackingNumber: trackingNumber || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to update");
      router.refresh();
    } catch (e) {
      console.error(e);
      alert("Failed to update status");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-3 space-y-3">
      <select
        className="w-full rounded-[12px] border border-[#F0D6E0] px-3 py-2 text-sm text-[#2D2A2B] focus:outline-none focus:ring-2 focus:ring-[#C45C7A]/40"
        value={status}
        onChange={(e) => setStatus(e.target.value)}
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <div>
        <label className="mb-1 block text-xs text-[#6B5E62]">Tracking number</label>
        <Input
          value={trackingNumber}
          onChange={(e) => setTrackingNumber(e.target.value)}
          placeholder="e.g. TCS123456"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-[#6B5E62]">Internal notes</label>
        <textarea
          className="w-full rounded-[12px] border border-[#F0D6E0] px-3 py-2 text-sm text-[#2D2A2B] focus:outline-none focus:ring-2 focus:ring-[#C45C7A]/40"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Refund note, customer request"
        />
      </div>
      <Button onClick={handleUpdate} disabled={loading} className="w-full">
        {loading ? "Updating..." : "Update order"}
      </Button>
    </div>
  );
}

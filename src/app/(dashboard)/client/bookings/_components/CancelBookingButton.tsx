"use client";
import { useState } from "react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

export function CancelBookingButton({ bookingId, className }: { bookingId: string; className?: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function cancel() {
    if (!confirm("Cancel this booking? Your credit may not be returned if it's within 12 hours.")) return;
    setLoading(true);
    const res = await fetch(`/api/bookings/${bookingId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "cancel" }) });
    const data = await res.json();
    setLoading(false);
    if (res.ok) { toast.success(data.message ?? "Booking cancelled"); router.refresh(); }
    else toast.error(data.error ?? "Could not cancel");
  }

  return (
    <button onClick={cancel} disabled={loading} className={className}>
      {loading ? "Cancelling..." : "Cancel booking"}
    </button>
  );
}

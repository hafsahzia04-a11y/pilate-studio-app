"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

interface Props {
  bookingId: string;
  classStartTime: string;   // ISO string
  isPriority: boolean;
}

export function CancelBookingButton({ bookingId, classStartTime, isPriority }: Props) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // How many hours until class
  const hoursUntil = (new Date(classStartTime).getTime() - Date.now()) / 1000 / 3600;
  const canCancel = isPriority && hoursUntil > 48;

  if (!isPriority) {
    return (
      <p className="text-xs text-stone-400 italic">
        Contact reception to cancel · <span className="not-italic">priority members only</span>
      </p>
    );
  }

  if (!canCancel) {
    return (
      <p className="text-xs text-amber-600 font-medium">
        Cancellation window closed — changes must be made 48h before class
      </p>
    );
  }

  async function cancel() {
    if (!confirm("Cancel this booking? Your credit will be returned.")) return;
    setLoading(true);
    const res = await fetch(`/api/bookings/${bookingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel" }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      toast.success(data.message ?? data.data?.message ?? "Booking cancelled — credit returned");
      router.refresh();
    } else {
      toast.error(data.error ?? "Could not cancel");
    }
  }

  return (
    <button onClick={cancel} disabled={loading} className="text-red-500 text-xs hover:underline disabled:opacity-50">
      {loading ? "Cancelling…" : "Cancel booking"}
    </button>
  );
}

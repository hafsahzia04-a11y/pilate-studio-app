"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

interface Booking { id: string; status: string; client: { id: string; fullName: string; clientProfile?: { medicalNotes?: string | null; injuryNotes?: string | null } | null } }

export function InstructorAttendance({ bookings: init, sessionId }: { bookings: Booking[]; sessionId: string }) {
  const [bookings, setBookings] = useState(init);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function mark(id: string, action: "attend" | "no_show") {
    setLoadingId(id);
    const res = await fetch(`/api/bookings/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    setLoadingId(null);
    if (res.ok) { setBookings(b => b.map(x => x.id === id ? { ...x, status: action === "attend" ? "attended" : "no_show" } : x)); toast.success("Updated!"); }
    else toast.error("Failed");
  }

  const attended = bookings.filter(b => b.status === "attended").length;

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-stone-600">{attended}/{bookings.length} attended</p>
      {bookings.map(b => {
        const hasNotes = b.client.clientProfile?.medicalNotes || b.client.clientProfile?.injuryNotes;
        return (
          <div key={b.id} className={cn("flex items-center gap-3 p-4 rounded-2xl border", b.status === "attended" ? "bg-sage-50 border-sage-200" : b.status === "no_show" ? "bg-red-50 border-red-100 opacity-60" : "bg-white border-stone-100")}>
            <div className="flex-1">
              <p className="font-semibold text-stone-900">{b.client.fullName}</p>
              {hasNotes && <p className="text-xs text-amber-600 mt-0.5">⚠️ {b.client.clientProfile?.injuryNotes ?? b.client.clientProfile?.medicalNotes}</p>}
            </div>
            {b.status === "attended" ? <Badge variant="sage">Attended</Badge>
              : b.status === "no_show" ? <Badge variant="danger">No Show</Badge>
              : <div className="flex gap-2">
                  <Button size="icon-sm" className="bg-sage-500 hover:bg-sage-600" loading={loadingId === b.id} onClick={() => mark(b.id, "attend")}><Check className="h-4 w-4" /></Button>
                  <Button size="icon-sm" variant="outline" className="border-red-200 text-red-400" loading={loadingId === b.id} onClick={() => mark(b.id, "no_show")}><X className="h-4 w-4" /></Button>
                </div>}
          </div>
        );
      })}
      {bookings.length === 0 && <p className="text-center text-stone-400 text-sm py-6">No bookings for this class</p>}
    </div>
  );
}

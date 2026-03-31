"use client";

import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, formatTime } from "@/lib/utils";
import { Check, X, Clock } from "lucide-react";
import toast from "react-hot-toast";

interface Session { id: string; title: string; startTime: string; capacity: number; bookedCount: number; category: { name: string; color: string } }
interface BookingRow { id: string; status: string; client: { id: string; fullName: string }; clientPackage?: { package: { name: string }; remainingCredits: number } | null }

export default function CheckInPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [roster, setRoster] = useState<BookingRow[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    fetch(`/api/classes?date=${today}&status=scheduled`).then(r => r.json()).then(data => setSessions(data ?? []));
    const t = setInterval(() => setTime(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    fetch(`/api/bookings?classSessionId=${selectedId}`).then(r => r.json()).then(data => setRoster(data ?? []));
  }, [selectedId]);

  async function mark(bookingId: string, action: "attend" | "no_show") {
    setLoadingId(bookingId);
    const res = await fetch(`/api/bookings/${bookingId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    setLoadingId(null);
    if (res.ok) {
      setRoster(prev => prev.map(b => b.id === bookingId ? { ...b, status: action === "attend" ? "attended" : "no_show" } : b));
      toast.success(action === "attend" ? "✅ Checked in!" : "Marked as no-show");
    } else toast.error("Action failed");
  }

  const statusBg: Record<string, string> = { attended: "bg-sage-50 border-sage-200", no_show: "bg-red-50 border-red-100 opacity-60", confirmed: "bg-white" };

  return (
    <DashboardLayout role="staff" userName="Staff" userEmail="" pageTitle="Check-In">
      <div className="space-y-4">
        {/* Clock */}
        <div className="text-center py-2">
          <p className="text-4xl font-bold text-stone-900 tabular-nums">{time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
        </div>

        {/* Class selector */}
        <div>
          <label className="text-sm font-medium text-stone-700 block mb-1.5">Select Class</label>
          <select value={selectedId ?? ""} onChange={e => setSelectedId(e.target.value)}
            className="w-full h-12 border border-stone-200 rounded-xl px-4 text-stone-800 text-sm bg-white focus:outline-none focus:border-sage-400">
            <option value="">Choose a class...</option>
            {sessions.map(s => (
              <option key={s.id} value={s.id}>{formatTime(s.startTime)} — {s.title} ({s.bookedCount}/{s.capacity})</option>
            ))}
          </select>
        </div>

        {/* Roster */}
        {selectedId && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-stone-600">{roster.filter(b => b.status === "attended").length}/{roster.length} checked in</p>

            {/* Progress bar */}
            <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
              <div className="h-full bg-sage-400 rounded-full transition-all"
                style={{ width: roster.length > 0 ? `${(roster.filter(b => b.status === "attended").length / roster.length) * 100}%` : "0%" }} />
            </div>

            {roster.map(booking => (
              <div key={booking.id} className={cn("flex items-center gap-3 p-4 rounded-2xl border", statusBg[booking.status] ?? "bg-white border-stone-100")}>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-stone-900 text-base leading-snug">{booking.client.fullName}</p>
                  <p className="text-xs text-stone-500">
                    {booking.clientPackage?.package.name ?? "No package"} · {booking.clientPackage?.remainingCredits ?? 0} credits left
                  </p>
                </div>

                {booking.status === "attended" ? (
                  <div className="w-10 h-10 bg-sage-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <Check className="h-5 w-5 text-white" />
                  </div>
                ) : booking.status === "no_show" ? (
                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <X className="h-5 w-5 text-red-500" />
                  </div>
                ) : (
                  <div className="flex gap-2 flex-shrink-0">
                    <Button size="icon" className="w-11 h-11 bg-sage-500 hover:bg-sage-600"
                      loading={loadingId === booking.id} onClick={() => mark(booking.id, "attend")}>
                      <Check className="h-5 w-5" />
                    </Button>
                    <Button size="icon" variant="outline" className="w-11 h-11 border-red-200 text-red-500 hover:bg-red-50"
                      loading={loadingId === booking.id} onClick={() => mark(booking.id, "no_show")}>
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                )}
              </div>
            ))}

            {roster.length === 0 && (
              <div className="text-center py-8 text-stone-400">
                <Clock className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No bookings for this class</p>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

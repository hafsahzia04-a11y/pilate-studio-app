"use client";

import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, formatTime, occupancyLabel, occupancyColor } from "@/lib/utils";
import { format, addDays } from "date-fns";
import { Clock, User, MapPin, Users } from "lucide-react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

interface Session {
  id: string; title: string; startTime: string; endTime: string; capacity: number;
  bookedCount: number; waitlistCount: number; spotsLeft: number; isFull: boolean;
  isWorkshop: boolean; workshopPrice: number | null; usesCredits: boolean;
  category: { name: string; color: string }; instructor: { fullName: string }; room: string | null;
}

export default function BookPage() {
  const router = useRouter();
  const days = Array.from({ length: 7 }, (_, i) => addDays(new Date(), i));
  const [selectedDay, setSelectedDay] = useState(0);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [catFilter, setCatFilter] = useState("all");

  const categories = [...new Set(sessions.map(s => s.category.name))];

  useEffect(() => {
    const date = format(days[selectedDay], "yyyy-MM-dd");
    setLoading(true);
    fetch(`/api/classes?date=${date}&status=scheduled`)
      .then(r => r.json()).then(data => setSessions(data ?? []))
      .finally(() => setLoading(false));
  }, [selectedDay]);

  const filtered = catFilter === "all" ? sessions : sessions.filter(s => s.category.name === catFilter);

  async function book(sessionId: string) {
    setBookingId(sessionId);
    const res = await fetch("/api/bookings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ classSessionId: sessionId }) });
    const data = await res.json();
    setBookingId(null);
    if (!res.ok) { toast.error(data.error ?? "Booking failed"); return; }
    if (data.waitlisted) { toast("You're on the waitlist at position " + data.position + " 🙏", { icon: "⏳" }); }
    else { toast.success("Booking confirmed! 🎉"); router.push("/client/bookings"); }
  }

  return (
    <DashboardLayout role="client" userName="" userEmail="" pageTitle="Book a Class">
      <div className="space-y-4">
        {/* Date selector */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          {days.map((day, i) => {
            const isToday = i === 0;
            return (
              <button key={i} onClick={() => setSelectedDay(i)}
                className={cn("flex flex-col items-center px-3.5 py-2 rounded-xl flex-shrink-0 transition-all", selectedDay === i ? "bg-sage-500 text-white" : "bg-white text-stone-600 border border-stone-200 hover:border-sage-300")}>
                <span className="text-[10px] font-medium">{format(day, "EEE")}</span>
                <span className="text-base font-bold">{format(day, "d")}</span>
                {isToday && <span className="text-[9px] mt-0.5">{selectedDay === i ? "Today" : "Today"}</span>}
              </button>
            );
          })}
        </div>

        {/* Category filter */}
        {categories.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {["all", ...categories].map(cat => (
              <button key={cat} onClick={() => setCatFilter(cat)}
                className={cn("px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all flex-shrink-0", catFilter === cat ? "bg-sage-500 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200")}>
                {cat === "all" ? "All Classes" : cat}
              </button>
            ))}
          </div>
        )}

        {/* Sessions */}
        {loading ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-28 bg-stone-100 rounded-2xl animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-stone-400">
            <Clock className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No classes on this day</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(s => (
              <Card key={s.id} className="p-4">
                <div className="flex gap-3">
                  <div className="w-1.5 self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: s.category.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-stone-900">{s.title}</p>
                        <p className="text-xs text-stone-500 mt-0.5">{s.category.name}</p>
                      </div>
                      <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0", occupancyColor(s.bookedCount, s.capacity))}>
                        {occupancyLabel(s.bookedCount, s.capacity)}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-stone-500">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatTime(s.startTime)} – {formatTime(s.endTime)}</span>
                      <span className="flex items-center gap-1"><User className="h-3 w-3" />{s.instructor.fullName}</span>
                      {s.room && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{s.room}</span>}
                    </div>

                    {s.isWorkshop && s.workshopPrice && (
                      <p className="mt-1.5 text-xs text-amber-700 font-medium">Workshop · {s.workshopPrice} AED</p>
                    )}

                    <div className="mt-3">
                      <Button size="sm" className="w-full" variant={s.isFull ? "secondary" : "default"}
                        loading={bookingId === s.id} onClick={() => book(s.id)}>
                        {s.isFull ? `Join Waitlist (+${s.waitlistCount} waiting)` : s.usesCredits ? "Book — 1 credit" : "Book"}
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, formatDate, formatTime, bookingStatusLabel, bookingStatusColor } from "@/lib/utils";
import { CancelBookingButton } from "./_components/CancelBookingButton";

export const metadata = { title: "My Bookings" };

export default async function ClientBookingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const profile = await prisma.profile.findUnique({ where: { id: user.id }, select: { fullName: true, email: true, role: true } });
  if (!profile) redirect("/login");

  const now = new Date();
  const allBookings = await prisma.booking.findMany({
    where: { clientId: user.id, status: { not: "waitlisted" } },
    include: {
      classSession: {
        select: { title: true, startTime: true, endTime: true, room: true, status: true, category: { select: { name: true, color: true } }, instructor: { select: { fullName: true } } },
      },
    },
    orderBy: { classSession: { startTime: "desc" } },
    take: 50,
  });

  const upcoming = allBookings.filter(b => new Date(b.classSession.startTime) >= now && b.status === "confirmed");
  const past = allBookings.filter(b => new Date(b.classSession.startTime) < now || b.status !== "confirmed");

  return (
    <DashboardLayout role="client" userName={profile.fullName} userEmail={profile.email} pageTitle="My Bookings">
      <div className="space-y-6">
        <div className="bg-cream-200 border border-stone-200 rounded-xl px-4 py-3">
          <p className="text-xs text-stone-600">Cancel at least <strong>12 hours before</strong> your class to get your credit back. Late cancellations and no-shows lose the credit.</p>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-stone-700 mb-3">Upcoming ({upcoming.length})</h2>
          {upcoming.length === 0 ? (
            <p className="text-sm text-stone-400 py-4 text-center">No upcoming bookings — <a href="/client/book" className="text-sage-600 font-medium">book a class!</a></p>
          ) : (
            <div className="space-y-2">
              {upcoming.map(b => (
                <Card key={b.id} className="p-4">
                  <div className="flex gap-3">
                    <div className="w-1.5 self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: b.classSession.category.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-stone-900">{b.classSession.title}</p>
                        <Badge variant="sage">Confirmed</Badge>
                      </div>
                      <p className="text-xs text-stone-500 mt-1">{formatDate(b.classSession.startTime, "EEE d MMM")} · {formatTime(b.classSession.startTime)} – {formatTime(b.classSession.endTime)}</p>
                      <p className="text-xs text-stone-400">{b.classSession.instructor.fullName}{b.classSession.room ? ` · ${b.classSession.room}` : ""}</p>
                      <div className="mt-3">
                        <CancelBookingButton bookingId={b.id} className="text-red-500 text-xs hover:underline" />
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {past.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-stone-700 mb-3">History</h2>
            <div className="space-y-2">
              {past.slice(0, 10).map(b => (
                <Card key={b.id} className="p-4 opacity-80">
                  <div className="flex gap-3">
                    <div className="w-1.5 self-stretch rounded-full flex-shrink-0 opacity-40" style={{ backgroundColor: b.classSession.category.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-stone-700 truncate">{b.classSession.title}</p>
                        <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", bookingStatusColor(b.status))}>{bookingStatusLabel(b.status)}</span>
                      </div>
                      <p className="text-xs text-stone-400 mt-0.5">{formatDate(b.classSession.startTime, "EEE d MMM yyyy")} · {formatTime(b.classSession.startTime)}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

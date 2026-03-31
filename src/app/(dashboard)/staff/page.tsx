import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatTime, occupancyColor, formatDate } from "@/lib/utils";
import Link from "next/link";
import { UserCheck, Calendar, Users, Clock } from "lucide-react";

export const metadata = { title: "Staff Dashboard" };

export default async function StaffDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const profile = await prisma.profile.findUnique({ where: { id: user.id }, select: { fullName: true, email: true, role: true } });
  if (!profile || !["founder", "staff"].includes(profile.role)) redirect("/login");

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

  const sessions = await prisma.classSession.findMany({
    where: { startTime: { gte: todayStart, lte: todayEnd }, status: "scheduled" },
    include: {
      category: { select: { name: true, color: true } },
      instructor: { select: { fullName: true } },
      _count: { select: { bookings: { where: { status: { in: ["confirmed", "attended"] } } } } },
    },
    orderBy: { startTime: "asc" },
  });

  const now = new Date();
  const upcoming = sessions.filter(s => new Date(s.startTime) > now && (new Date(s.startTime).getTime() - now.getTime()) < 30 * 60000);

  return (
    <DashboardLayout role={profile.role as "staff"} userName={profile.fullName} userEmail={profile.email} pageTitle="Today">
      <div className="space-y-5">
        <div>
          <p className="text-2xl font-bold text-stone-900">{formatDate(new Date(), "EEEE")}</p>
          <p className="text-stone-500 text-sm">{formatDate(new Date(), "d MMMM yyyy")}</p>
        </div>

        {upcoming.length > 0 && (
          <div className="bg-sage-50 border border-sage-200 rounded-2xl p-4">
            <p className="text-sm font-semibold text-sage-800 mb-2">⏰ Starting Soon</p>
            {upcoming.map(s => (
              <p key={s.id} className="text-sm text-sage-700">{s.title} at {formatTime(s.startTime)} — {s._count.bookings}/{s.capacity} booked</p>
            ))}
          </div>
        )}

        {/* Quick actions */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Check-In", href: "/staff/checkin", icon: <UserCheck className="h-5 w-5" />, color: "bg-sage-500 text-white" },
            { label: "Schedule", href: "/staff/schedule", icon: <Calendar className="h-5 w-5" />, color: "bg-white text-stone-700 border border-stone-200" },
            { label: "Clients", href: "/staff/clients", icon: <Users className="h-5 w-5" />, color: "bg-white text-stone-700 border border-stone-200" },
          ].map(a => (
            <Link key={a.href} href={a.href} className={cn("flex flex-col items-center gap-2 py-4 rounded-2xl font-medium text-sm transition-all hover:opacity-90 active:scale-95", a.color)}>
              {a.icon}{a.label}
            </Link>
          ))}
        </div>

        <div>
          <h2 className="text-sm font-semibold text-stone-700 mb-3">Today's Classes ({sessions.length})</h2>
          <div className="space-y-2">
            {sessions.map(s => (
              <Card key={s.id} className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-12 rounded-full flex-shrink-0" style={{ backgroundColor: s.category.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-stone-900 truncate">{s.title}</p>
                    <p className="text-xs text-stone-500">{formatTime(s.startTime)} · {s.instructor.fullName}</p>
                  </div>
                  <span className={cn("text-xs font-medium px-2 py-1 rounded-full", occupancyColor(s._count.bookings, s.capacity))}>
                    {s._count.bookings}/{s.capacity}
                  </span>
                </div>
              </Card>
            ))}
            {sessions.length === 0 && (
              <div className="text-center py-8 text-stone-400">
                <Clock className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No classes scheduled today</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

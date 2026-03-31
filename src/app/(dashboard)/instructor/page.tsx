import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, formatDate, formatTime, occupancyColor } from "@/lib/utils";
import Link from "next/link";
import { Calendar } from "lucide-react";

export const metadata = { title: "My Classes" };

export default async function InstructorDashPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const profile = await prisma.profile.findUnique({ where: { id: user.id }, select: { fullName: true, email: true, role: true } });
  if (!profile || !["founder", "instructor"].includes(profile.role)) redirect("/login");

  const now = new Date();
  const weekAhead = new Date(now.getTime() + 7 * 86400000);

  const sessions = await prisma.classSession.findMany({
    where: {
      OR: [{ instructorId: user.id }, { substituteInstructorId: user.id }],
      startTime: { gte: now, lte: weekAhead },
      status: "scheduled",
    },
    include: {
      category: { select: { name: true, color: true } },
      _count: { select: { bookings: { where: { status: { in: ["confirmed", "attended"] } } } } },
    },
    orderBy: { startTime: "asc" },
  });

  return (
    <DashboardLayout role="instructor" userName={profile.fullName} userEmail={profile.email} pageTitle="My Classes">
      <div className="space-y-4">
        <p className="text-sm text-stone-500">Your upcoming classes (next 7 days)</p>
        {sessions.length === 0 ? (
          <div className="text-center py-12 text-stone-400">
            <Calendar className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No upcoming classes this week</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map(s => (
              <Link key={s.id} href={`/instructor/classes?session=${s.id}`}>
                <Card className="p-4 hover:shadow-soft transition-shadow cursor-pointer">
                  <div className="flex gap-3">
                    <div className="w-1.5 rounded-full flex-shrink-0 self-stretch" style={{ backgroundColor: s.category.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-stone-900">{s.title}</p>
                        <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", occupancyColor(s._count.bookings, s.capacity))}>
                          {s._count.bookings}/{s.capacity}
                        </span>
                      </div>
                      <p className="text-xs text-stone-500 mt-1">{formatDate(s.startTime, "EEE d MMM")} · {formatTime(s.startTime)}</p>
                      <p className="text-xs text-stone-400 mt-0.5">{s.category.name}{s.room ? ` · ${s.room}` : ""}</p>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

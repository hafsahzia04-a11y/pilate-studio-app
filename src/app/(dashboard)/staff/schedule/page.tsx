import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ScheduleView } from "../../founder/schedule/_components/ScheduleView";
import { addDays, startOfDay } from "date-fns";

export const metadata = { title: "Schedule" };

export default async function StaffSchedulePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const profile = await prisma.profile.findUnique({ where: { id: user.id }, select: { fullName: true, email: true, role: true } });
  if (!profile || !["founder", "staff"].includes(profile.role)) redirect("/login");

  const from = startOfDay(new Date());
  const to = addDays(from, 7);

  const sessions = await prisma.classSession.findMany({
    where: { startTime: { gte: from, lt: to }, status: { not: "cancelled" } },
    include: {
      category: { select: { name: true, color: true } },
      instructor: { select: { id: true, fullName: true } },
      substituteInstructor: { select: { id: true, fullName: true } },
      _count: { select: { bookings: { where: { status: { in: ["confirmed", "attended"] } } }, waitlist: { where: { status: "waiting" } } } },
    },
    orderBy: { startTime: "asc" },
  });

  const enriched = sessions.map(s => ({ ...s, bookedCount: s._count.bookings, waitlistCount: s._count.waitlist, spotsLeft: Math.max(0, s.capacity - s._count.bookings), isFull: s._count.bookings >= s.capacity, startTime: s.startTime.toISOString(), endTime: s.endTime.toISOString() }));

  return (
    <DashboardLayout role={profile.role as "staff"} userName={profile.fullName} userEmail={profile.email} pageTitle="Schedule">
      <ScheduleView sessions={enriched} instructors={[]} categories={[]} />
    </DashboardLayout>
  );
}

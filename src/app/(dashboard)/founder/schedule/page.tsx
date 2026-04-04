import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ScheduleView } from "./_components/ScheduleView";
import { addDays, startOfDay } from "date-fns";

export const metadata = { title: "Schedule" };

export default async function FounderSchedulePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    select: { fullName: true, email: true, role: true },
  });
  if (!profile || profile.role !== "founder") redirect("/login");

  const from = startOfDay(new Date());
  const to = addDays(from, 14);

  const sessions = await prisma.classSession.findMany({
    where: {
      startTime: { gte: from, lt: to },
      status: { not: "cancelled" },
    },
    include: {
      category: { select: { name: true, color: true } },
      instructor: { select: { id: true, fullName: true } },
      substituteInstructor: { select: { id: true, fullName: true } },
      _count: {
        select: {
          bookings: { where: { status: { in: ["confirmed", "attended"] } } },
          waitlist: { where: { status: "waiting" } },
        },
      },
    },
    orderBy: { startTime: "asc" },
  });

  const instructors = await prisma.profile.findMany({
    where: { role: "instructor", status: "active" },
    select: { id: true, fullName: true },
  });

  const categories = await prisma.classCategory.findMany({
    where: { isActive: true },
    select: { id: true, name: true, color: true },
    orderBy: { sortOrder: "asc" },
  });

  const enriched = sessions.map((s) => ({
    ...s,
    bookedCount: s._count.bookings,
    waitlistCount: s._count.waitlist,
    spotsLeft: Math.max(0, s.capacity - s._count.bookings),
    isFull: s._count.bookings >= s.capacity,
    startTime: s.startTime.toISOString(),
    endTime: s.endTime.toISOString(),
  }));

  return (
    <DashboardLayout
      role="founder"
      userName={profile.fullName}
      userEmail={profile.email}
      pageTitle="Weekly Schedule"
    >
      <ScheduleView
        sessions={enriched}
        instructors={instructors}
        categories={categories}
      />
    </DashboardLayout>
  );
}

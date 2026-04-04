import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { InstructorsList } from "./_components/InstructorsList";

export const metadata = { title: "Instructors" };

export default async function FounderInstructorsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    select: { fullName: true, email: true, role: true },
  });
  if (!profile || profile.role !== "founder") redirect("/login");

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // Fetch instructors — _count for taughtSessions is always safe (pre-existing table)
  const instructors = await prisma.profile.findMany({
    where: { role: "instructor" },
    include: {
      instructorProfile: true,
      _count: {
        select: {
          taughtSessions: { where: { status: { in: ["scheduled", "completed"] } } },
        },
      },
    },
    orderBy: { fullName: "asc" },
  });

  // Fetch referral counts safely (new table — may not exist yet)
  const referralCounts = await prisma.instructorReferral
    .groupBy({ by: ["instructorId"], _count: { id: true } })
    .catch(() => [] as { instructorId: string; _count: { id: number } }[]);
  const referralMap = new Map(referralCounts.map((r) => [r.instructorId, r._count.id]));

  // Fetch current-month salary records safely (new table — may not exist yet)
  const salaryRecords = await prisma.instructorSalaryRecord
    .findMany({
      where: {
        month: currentMonth,
        year: currentYear,
        instructorId: { in: instructors.map((i) => i.id) },
      },
    })
    .catch(() => [] as Awaited<ReturnType<typeof prisma.instructorSalaryRecord.findMany>>);

  const salaryMap = new Map(salaryRecords.map((r) => [r.instructorId, r]));

  // Analytics summary
  const totalInstructors = instructors.length;
  const activeInstructors = instructors.filter((i) => i.status === "active").length;
  const salariesDue = salaryRecords.filter((r) => r.paymentStatus === "unpaid").length;
  const salariesOverdue = salaryRecords.filter(
    (r) => r.paymentStatus === "unpaid" && new Date(r.dueDate) < now
  ).length;

  const enriched = instructors.map((i) => ({
    id: i.id,
    fullName: i.fullName,
    email: i.email,
    phone: i.phone,
    status: i.status,
    instructorProfile: i.instructorProfile
      ? {
          specializations: i.instructorProfile.specializations,
          payoutType: i.instructorProfile.payoutType,
          payoutRate: Number(i.instructorProfile.payoutRate),
          salary: i.instructorProfile.salary ? Number(i.instructorProfile.salary) : null,
          salaryDueDay: i.instructorProfile.salaryDueDay,
          commissionPercent: i.instructorProfile.commissionPercent
            ? Number(i.instructorProfile.commissionPercent)
            : null,
          startDate: i.instructorProfile.startDate?.toISOString() ?? null,
          isAvailable: i.instructorProfile.isAvailable,
        }
      : null,
    totalSessions: i._count.taughtSessions,
    totalReferrals: referralMap.get(i.id) ?? 0,
    currentSalaryRecord: salaryMap.get(i.id)
      ? {
          id: salaryMap.get(i.id)!.id,
          amountDue: Number(salaryMap.get(i.id)!.amountDue),
          amountPaid: Number(salaryMap.get(i.id)!.amountPaid),
          paymentStatus: salaryMap.get(i.id)!.paymentStatus,
          dueDate: salaryMap.get(i.id)!.dueDate.toISOString(),
        }
      : null,
  }));

  return (
    <DashboardLayout role="founder" userName={profile.fullName} userEmail={profile.email} pageTitle="Instructors">
      <InstructorsList
        instructors={enriched}
        summary={{ totalInstructors, activeInstructors, salariesDue, salariesOverdue }}
      />
    </DashboardLayout>
  );
}

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

  const instructors = await prisma.profile.findMany({
    where: { role: "instructor" },
    include: {
      instructorProfile: true,
      _count: {
        select: {
          taughtSessions: { where: { status: { in: ["scheduled", "completed"] } } },
          instructorReferrals: true,
        },
      },
    },
    orderBy: { fullName: "asc" },
  });

  const salaryRecords = await prisma.instructorSalaryRecord.findMany({
    where: {
      month: currentMonth,
      year: currentYear,
      instructorId: { in: instructors.map((i) => i.id) },
    },
  });

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
    totalReferrals: i._count.instructorReferrals,
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

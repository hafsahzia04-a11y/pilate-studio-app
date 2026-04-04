import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { InstructorDetail } from "./_components/InstructorDetail";

export const metadata = { title: "Instructor Profile" };

export default async function InstructorDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const actor = await prisma.profile.findUnique({
    where: { id: user.id },
    select: { fullName: true, email: true, role: true },
  });
  if (!actor || actor.role !== "founder") redirect("/login");

  const instructor = await prisma.profile.findUnique({
    where: { id: params.id, role: "instructor" },
    include: {
      instructorProfile: true,
      taughtSessions: {
        orderBy: { startTime: "desc" },
        take: 100,
        include: {
          category: { select: { name: true, color: true } },
          classMetric: true,
          _count: {
            select: {
              bookings: { where: { status: { in: ["confirmed", "attended"] } } },
            },
          },
        },
      },
      salaryRecords: {
        orderBy: [{ year: "desc" }, { month: "desc" }],
      },
      instructorReferrals: {
        include: {
          client: { select: { id: true, fullName: true, email: true, status: true } },
        },
        orderBy: { referralDate: "desc" },
      },
    },
  });

  if (!instructor) notFound();

  // Serialise all dates to ISO strings so client receives plain objects
  const serialised = {
    id: instructor.id,
    fullName: instructor.fullName,
    email: instructor.email,
    phone: instructor.phone,
    status: instructor.status,
    createdAt: instructor.createdAt.toISOString(),
    instructorProfile: instructor.instructorProfile
      ? {
          bio: instructor.instructorProfile.bio,
          specializations: instructor.instructorProfile.specializations,
          payoutType: instructor.instructorProfile.payoutType,
          payoutRate: Number(instructor.instructorProfile.payoutRate),
          salary: instructor.instructorProfile.salary ? Number(instructor.instructorProfile.salary) : null,
          salaryDueDay: instructor.instructorProfile.salaryDueDay,
          commissionPercent: instructor.instructorProfile.commissionPercent
            ? Number(instructor.instructorProfile.commissionPercent)
            : null,
          startDate: instructor.instructorProfile.startDate?.toISOString() ?? null,
          isAvailable: instructor.instructorProfile.isAvailable,
          notes: instructor.instructorProfile.notes,
        }
      : null,
    classSessions: instructor.taughtSessions.map((s) => ({
      id: s.id,
      title: s.title,
      startTime: s.startTime.toISOString(),
      endTime: s.endTime.toISOString(),
      status: s.status,
      capacity: s.capacity,
      bookedCount: s._count.bookings,
      category: s.category,
      classMetric: s.classMetric
        ? {
            bookedCount: s.classMetric.bookedCount,
            attendedCount: s.classMetric.attendedCount,
            noShowCount: s.classMetric.noShowCount,
          }
        : null,
    })),
    salaryRecords: instructor.salaryRecords.map((r) => ({
      id: r.id,
      month: r.month,
      year: r.year,
      amountDue: Number(r.amountDue),
      amountPaid: Number(r.amountPaid),
      paymentStatus: r.paymentStatus,
      dueDate: r.dueDate.toISOString(),
      paidAt: r.paidAt?.toISOString() ?? null,
      paymentMethod: r.paymentMethod,
      notes: r.notes,
    })),
    instructorReferrals: instructor.instructorReferrals.map((r) => ({
      id: r.id,
      clientId: r.clientId,
      isActive: r.isActive,
      referralDate: r.referralDate.toISOString(),
      notes: r.notes,
      client: r.client,
    })),
  };

  // All clients for referral picker
  const allClients = await prisma.profile.findMany({
    where: { role: "client", status: "active" },
    select: { id: true, fullName: true, email: true },
    orderBy: { fullName: "asc" },
  });

  return (
    <DashboardLayout role="founder" userName={actor.fullName} userEmail={actor.email} pageTitle="Instructor Profile">
      <InstructorDetail instructor={serialised} allClients={allClients} />
    </DashboardLayout>
  );
}

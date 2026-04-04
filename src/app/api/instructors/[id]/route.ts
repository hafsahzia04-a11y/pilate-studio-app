// GET   /api/instructors/[id]  — full instructor profile
// PATCH /api/instructors/[id]  — update instructor

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { audit, AUDIT_ACTIONS } from "@/lib/audit";
import { apiError, apiSuccess } from "@/lib/utils";

// ─── GET /api/instructors/[id] ────────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorised", 401);

  const actor = await prisma.profile.findUnique({ where: { id: user.id } });
  if (!["founder", "staff"].includes(actor?.role ?? "")) {
    return apiError("Forbidden", 403);
  }

  const instructor = await prisma.profile.findUnique({
    where: { id: params.id, role: "instructor" },
    include: {
      instructorProfile: true,
      taughtSessions: {
        orderBy: { startTime: "desc" },
        take: 50,
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
        take: 24,
      },
      instructorReferrals: {
        include: {
          client: { select: { id: true, fullName: true, email: true, status: true } },
        },
        orderBy: { referralDate: "desc" },
      },
    },
  });

  if (!instructor) return apiError("Instructor not found", 404);

  return apiSuccess(instructor);
}

// ─── PATCH /api/instructors/[id] ──────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorised", 401);

  const actor = await prisma.profile.findUnique({ where: { id: user.id } });
  if (actor?.role !== "founder") return apiError("Only founders can update instructors", 403);

  const instructor = await prisma.profile.findUnique({
    where: { id: params.id, role: "instructor" },
    include: { instructorProfile: true },
  });
  if (!instructor) return apiError("Instructor not found", 404);

  const body = await request.json();
  const { fullName, phone, status, bio, specializations, payoutType, payoutRate, salary, salaryDueDay, commissionPercent, startDate, notes } = body;

  const [updatedProfile] = await prisma.$transaction([
    prisma.profile.update({
      where: { id: params.id },
      data: {
        ...(fullName && { fullName }),
        ...(phone !== undefined && { phone }),
        ...(status && { status }),
      },
    }),
    prisma.instructorProfile.upsert({
      where: { id: params.id },
      create: {
        id: params.id,
        bio: bio ?? null,
        specializations: specializations ?? [],
        payoutType: payoutType ?? "per_class",
        payoutRate: payoutRate ?? 0,
        salary: salary ?? null,
        salaryDueDay: salaryDueDay ?? null,
        commissionPercent: commissionPercent ?? null,
        startDate: startDate ? new Date(startDate) : null,
        notes: notes ?? null,
      },
      update: {
        ...(bio !== undefined && { bio }),
        ...(specializations && { specializations }),
        ...(payoutType && { payoutType }),
        ...(payoutRate !== undefined && { payoutRate }),
        ...(salary !== undefined && { salary }),
        ...(salaryDueDay !== undefined && { salaryDueDay }),
        ...(commissionPercent !== undefined && { commissionPercent }),
        ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
        ...(notes !== undefined && { notes }),
      },
    }),
  ]);

  await audit({
    actorId: user.id,
    action: AUDIT_ACTIONS.INSTRUCTOR_UPDATED,
    entityType: "instructor",
    entityId: params.id,
    oldValue: { fullName: instructor.fullName, status: instructor.status },
    newValue: body,
  });

  return apiSuccess(updatedProfile);
}

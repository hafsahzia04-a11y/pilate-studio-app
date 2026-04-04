// GET  /api/instructors  — list instructors (founder/staff)
// POST /api/instructors  — create a new instructor profile

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";
import { audit, AUDIT_ACTIONS } from "@/lib/audit";
import { apiError, apiSuccess } from "@/lib/utils";

// ─── GET /api/instructors ──────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorised", 401);

  const actor = await prisma.profile.findUnique({ where: { id: user.id } });
  if (!["founder", "staff"].includes(actor?.role ?? "")) {
    return apiError("Forbidden", 403);
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search");
  const status = searchParams.get("status"); // "active" | "inactive"

  const instructors = await prisma.profile.findMany({
    where: {
      role: "instructor",
      ...(status && { status: status as never }),
      ...(search && {
        OR: [
          { fullName: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
        ],
      }),
    },
    include: {
      instructorProfile: true,
      taughtSessions: {
        where: { status: "scheduled" },
        select: { id: true, startTime: true },
        orderBy: { startTime: "asc" },
        take: 5,
      },
      _count: {
        select: {
          taughtSessions: { where: { status: { in: ["scheduled", "completed"] } } },
          instructorReferrals: true,
        },
      },
    },
    orderBy: { fullName: "asc" },
  });

  // Attach latest salary record status
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const salaryRecords = await prisma.instructorSalaryRecord.findMany({
    where: {
      month: currentMonth,
      year: currentYear,
      instructorId: { in: instructors.map((i) => i.id) },
    },
  });

  const salaryMap = new Map(salaryRecords.map((r) => [r.instructorId, r]));

  const enriched = instructors.map((i) => ({
    id: i.id,
    fullName: i.fullName,
    email: i.email,
    phone: i.phone,
    status: i.status,
    instructorProfile: i.instructorProfile,
    totalSessions: i._count.taughtSessions,
    totalReferrals: i._count.instructorReferrals,
    upcomingSessions: i.taughtSessions,
    currentSalaryRecord: salaryMap.get(i.id) ?? null,
  }));

  return apiSuccess(enriched);
}

// ─── POST /api/instructors ─────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorised", 401);

  const actor = await prisma.profile.findUnique({ where: { id: user.id } });
  if (actor?.role !== "founder") return apiError("Only founders can add instructors", 403);

  const body = await request.json();
  const { fullName, email, phone, specializations, bio, payoutType, payoutRate, salary, salaryDueDay, commissionPercent, startDate, notes } = body;

  if (!fullName || !email) {
    return apiError("fullName and email are required");
  }

  // Create Supabase auth user
  const adminSupabase = await createAdminClient();
  const tempPassword = Math.random().toString(36).slice(-10) + "A1!";
  const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
  });

  if (authError || !authData.user) {
    return apiError(authError?.message ?? "Failed to create auth user");
  }

  const newId = authData.user.id;

  const profile = await prisma.profile.create({
    data: {
      id: newId,
      fullName,
      email,
      phone: phone ?? null,
      role: "instructor",
      status: "active",
      instructorProfile: {
        create: {
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
      },
    },
    include: { instructorProfile: true },
  });

  await audit({
    actorId: user.id,
    action: AUDIT_ACTIONS.INSTRUCTOR_CREATED,
    entityType: "instructor",
    entityId: newId,
    newValue: { fullName, email, payoutType },
  });

  return apiSuccess(profile, 201);
}

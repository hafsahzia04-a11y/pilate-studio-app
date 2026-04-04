// GET   /api/instructors/[id]/salary  — list salary records
// POST  /api/instructors/[id]/salary  — create/update monthly salary record
// PATCH /api/instructors/[id]/salary  — record payment against existing record

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { audit, AUDIT_ACTIONS } from "@/lib/audit";
import { apiError, apiSuccess } from "@/lib/utils";

// ─── GET /api/instructors/[id]/salary ─────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorised", 401);

  const actor = await prisma.profile.findUnique({ where: { id: user.id } });
  if (actor?.role !== "founder") return apiError("Forbidden", 403);

  const records = await prisma.instructorSalaryRecord.findMany({
    where: { instructorId: params.id },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });

  return apiSuccess(records);
}

// ─── POST /api/instructors/[id]/salary ────────────────────────────────────────
// Create (or upsert) the monthly salary record for a given month/year

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorised", 401);

  const actor = await prisma.profile.findUnique({ where: { id: user.id } });
  if (actor?.role !== "founder") return apiError("Forbidden", 403);

  const instructor = await prisma.profile.findUnique({
    where: { id: params.id, role: "instructor" },
  });
  if (!instructor) return apiError("Instructor not found", 404);

  const body = await request.json();
  const { month, year, amountDue, dueDate, notes } = body;

  if (!month || !year || !amountDue || !dueDate) {
    return apiError("month, year, amountDue, dueDate are required");
  }

  const record = await prisma.instructorSalaryRecord.upsert({
    where: { instructorId_month_year: { instructorId: params.id, month, year } },
    create: {
      instructorId: params.id,
      month,
      year,
      amountDue,
      amountPaid: 0,
      paymentStatus: "unpaid",
      dueDate: new Date(dueDate),
      notes: notes ?? null,
    },
    update: {
      amountDue,
      dueDate: new Date(dueDate),
      ...(notes !== undefined && { notes }),
    },
  });

  await audit({
    actorId: user.id,
    action: AUDIT_ACTIONS.SALARY_RECORD_CREATED,
    entityType: "instructor_salary_record",
    entityId: record.id,
    newValue: { instructorId: params.id, month, year, amountDue },
  });

  return apiSuccess(record, 201);
}

// ─── PATCH /api/instructors/[id]/salary ───────────────────────────────────────
// Record a salary payment (full or partial)

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorised", 401);

  const actor = await prisma.profile.findUnique({ where: { id: user.id } });
  if (actor?.role !== "founder") return apiError("Forbidden", 403);

  const body = await request.json();
  const { recordId, amountPaid, paymentMethod, notes } = body;

  if (!recordId || amountPaid === undefined) {
    return apiError("recordId and amountPaid are required");
  }

  const record = await prisma.instructorSalaryRecord.findUnique({
    where: { id: recordId },
  });
  if (!record || record.instructorId !== params.id) {
    return apiError("Salary record not found", 404);
  }

  const newAmountPaid = Number(record.amountPaid) + Number(amountPaid);
  const newStatus = newAmountPaid >= Number(record.amountDue) ? "paid" : "partial";

  const updated = await prisma.instructorSalaryRecord.update({
    where: { id: recordId },
    data: {
      amountPaid: newAmountPaid,
      paymentStatus: newStatus,
      paymentMethod: paymentMethod ?? record.paymentMethod,
      paidAt: newStatus === "paid" ? new Date() : record.paidAt,
      ...(notes !== undefined && { notes }),
    },
  });

  await audit({
    actorId: user.id,
    action: AUDIT_ACTIONS.SALARY_PAYMENT_RECORDED,
    entityType: "instructor_salary_record",
    entityId: recordId,
    newValue: { amountPaid, paymentMethod, newStatus },
  });

  return apiSuccess(updated);
}

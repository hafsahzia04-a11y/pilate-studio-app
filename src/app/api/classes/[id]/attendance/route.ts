// GET   /api/classes/[id]/attendance  — get attendance record for a session
// POST  /api/classes/[id]/attendance  — create/update attendance record

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { audit, AUDIT_ACTIONS } from "@/lib/audit";
import { apiError, apiSuccess } from "@/lib/utils";

// ─── GET /api/classes/[id]/attendance ─────────────────────────────────────────

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

  const record = await prisma.classAttendanceRecord.findUnique({
    where: { classSessionId: params.id },
    include: {
      instructor: { select: { id: true, fullName: true } },
      recordedBy: { select: { id: true, fullName: true } },
    },
  });

  return apiSuccess(record);
}

// ─── POST /api/classes/[id]/attendance ────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorised", 401);

  const actor = await prisma.profile.findUnique({ where: { id: user.id } });
  if (!["founder", "staff"].includes(actor?.role ?? "")) {
    return apiError("Forbidden", 403);
  }

  const session = await prisma.classSession.findUnique({ where: { id: params.id } });
  if (!session) return apiError("Class session not found", 404);

  const body = await request.json();
  const { bookedCount, attendedCount, noShowCount, notes } = body;

  if (bookedCount === undefined || attendedCount === undefined || noShowCount === undefined) {
    return apiError("bookedCount, attendedCount, noShowCount are required");
  }

  const record = await prisma.classAttendanceRecord.upsert({
    where: { classSessionId: params.id },
    create: {
      classSessionId: params.id,
      instructorId: session.instructorId,
      bookedCount: Number(bookedCount),
      attendedCount: Number(attendedCount),
      noShowCount: Number(noShowCount),
      notes: notes ?? null,
      recordedById: user.id,
    },
    update: {
      bookedCount: Number(bookedCount),
      attendedCount: Number(attendedCount),
      noShowCount: Number(noShowCount),
      notes: notes ?? null,
      recordedById: user.id,
    },
    include: {
      instructor: { select: { id: true, fullName: true } },
      recordedBy: { select: { id: true, fullName: true } },
    },
  });

  await audit({
    actorId: user.id,
    action: AUDIT_ACTIONS.CLASS_ATTENDANCE_RECORDED,
    entityType: "class_attendance_record",
    entityId: record.id,
    newValue: { classSessionId: params.id, bookedCount, attendedCount, noShowCount },
  });

  return apiSuccess(record, 201);
}

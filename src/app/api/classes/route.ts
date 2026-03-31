// GET  /api/classes   — list sessions with filters
// POST /api/classes   — create a new session (founder/staff)

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { audit, AUDIT_ACTIONS } from "@/lib/audit";
import { apiError, apiSuccess } from "@/lib/utils";
import { getSetting } from "@/lib/settings";
import { addMinutes } from "date-fns";

// ─── GET /api/classes ─────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");               // "YYYY-MM-DD"
  const from = searchParams.get("from");               // ISO string
  const to = searchParams.get("to");                   // ISO string
  const instructorId = searchParams.get("instructorId");
  const categoryId = searchParams.get("categoryId");
  const isWorkshop = searchParams.get("isWorkshop");
  const status = searchParams.get("status") ?? "scheduled";

  const where: Record<string, unknown> = {};

  if (date) {
    const start = new Date(`${date}T00:00:00`);
    const end = new Date(`${date}T23:59:59`);
    where.startTime = { gte: start, lte: end };
  } else if (from || to) {
    where.startTime = {
      ...(from && { gte: new Date(from) }),
      ...(to && { lte: new Date(to) }),
    };
  }

  if (instructorId) where.instructorId = instructorId;
  if (categoryId) where.categoryId = categoryId;
  if (isWorkshop !== null) where.isWorkshop = isWorkshop === "true";
  if (status !== "all") where.status = status;

  const sessions = await prisma.classSession.findMany({
    where,
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

  // Enrich with occupancy info
  const enriched = sessions.map((s) => ({
    ...s,
    bookedCount: s._count.bookings,
    waitlistCount: s._count.waitlist,
    spotsLeft: Math.max(0, s.capacity - s._count.bookings),
    isFull: s._count.bookings >= s.capacity,
  }));

  return apiSuccess(enriched);
}

// ─── POST /api/classes ────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorised", 401);

  const profile = await prisma.profile.findUnique({ where: { id: user.id } });
  if (!profile || !["founder", "staff"].includes(profile.role)) {
    return apiError("Forbidden", 403);
  }

  const body = await request.json();
  const {
    title, categoryId, instructorId, room,
    startTime, durationMins, capacity,
    isWorkshop, workshopPrice, usesCredits,
    description, templateId, recurringRuleId,
    bufferTimeMins,
  } = body;

  if (!title || !categoryId || !instructorId || !startTime || !durationMins) {
    return apiError("Missing required fields: title, categoryId, instructorId, startTime, durationMins");
  }

  const defaultCapacity = await getSetting("max_class_capacity");
  const defaultBuffer = await getSetting("default_buffer_time_mins");

  const start = new Date(startTime);
  const end = addMinutes(start, Number(durationMins));

  // Check instructor isn't teaching another class at this time
  const conflict = await prisma.classSession.findFirst({
    where: {
      instructorId,
      status: "scheduled",
      startTime: { lt: end },
      endTime: { gt: start },
    },
  });
  if (conflict) {
    return apiError(`Instructor already has a class at this time: "${conflict.title}"`);
  }

  const session = await prisma.classSession.create({
    data: {
      title,
      categoryId,
      instructorId,
      room: room ?? null,
      startTime: start,
      endTime: end,
      durationMins: Number(durationMins),
      bufferTimeMins: Number(bufferTimeMins ?? defaultBuffer),
      capacity: Number(capacity ?? defaultCapacity),
      isWorkshop: Boolean(isWorkshop),
      workshopPrice: workshopPrice ? Number(workshopPrice) : null,
      usesCredits: usesCredits !== false,
      description: description ?? null,
      templateId: templateId ?? null,
      recurringRuleId: recurringRuleId ?? null,
      status: "scheduled",
    },
    include: {
      category: true,
      instructor: { select: { fullName: true } },
    },
  });

  await audit({
    actorId: user.id,
    action: AUDIT_ACTIONS.CLASS_SESSION_CREATED,
    entityType: "class_session",
    entityId: session.id,
    newValue: { title, startTime, instructorId, capacity: session.capacity },
  });

  return apiSuccess(session, 201);
}

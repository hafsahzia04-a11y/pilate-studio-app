// GET    /api/classes/[id]  — single session with roster
// PATCH  /api/classes/[id]  — update session (instructor change, cancel, etc.)
// DELETE /api/classes/[id]  — soft-delete / cancel (never hard delete)

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { audit, AUDIT_ACTIONS } from "@/lib/audit";
import { apiError, apiSuccess } from "@/lib/utils";
import { sendWhatsAppMessage, messages } from "@/lib/whatsapp";
import { formatDateTime } from "@/lib/utils";

// ─── GET /api/classes/[id] ────────────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await prisma.classSession.findUnique({
    where: { id: params.id },
    include: {
      category: true,
      instructor: { select: { id: true, fullName: true, phone: true } },
      substituteInstructor: { select: { id: true, fullName: true } },
      bookings: {
        where: { status: { in: ["confirmed", "attended"] } },
        include: {
          client: {
            select: {
              id: true,
              fullName: true,
              phone: true,
              clientProfile: { select: { tags: true, medicalNotes: true } },
            },
          },
          clientPackage: {
            select: {
              package: { select: { name: true } },
              remainingCredits: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      waitlist: {
        where: { status: "waiting" },
        include: {
          client: { select: { id: true, fullName: true } },
        },
        orderBy: { position: "asc" },
      },
      _count: {
        select: {
          bookings: { where: { status: { in: ["confirmed", "attended"] } } },
          waitlist: { where: { status: "waiting" } },
        },
      },
    },
  });

  if (!session) return apiError("Class not found", 404);

  return apiSuccess({
    ...session,
    bookedCount: session._count.bookings,
    waitlistCount: session._count.waitlist,
    spotsLeft: Math.max(0, session.capacity - session._count.bookings),
    isFull: session._count.bookings >= session.capacity,
  });
}

// ─── PATCH /api/classes/[id] ──────────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorised", 401);

  const profile = await prisma.profile.findUnique({ where: { id: user.id } });
  if (!profile || !["founder", "staff"].includes(profile.role)) {
    return apiError("Forbidden", 403);
  }

  const session = await prisma.classSession.findUnique({ where: { id: params.id } });
  if (!session) return apiError("Class not found", 404);

  const body = await request.json();
  const old = { ...session };

  // Determine if instructor is changing (triggers notification)
  const instructorChanging =
    body.instructorId && body.instructorId !== session.instructorId;

  const updated = await prisma.classSession.update({
    where: { id: params.id },
    data: {
      ...(body.title && { title: body.title }),
      ...(body.instructorId && { instructorId: body.instructorId }),
      ...(body.substituteInstructorId !== undefined && {
        substituteInstructorId: body.substituteInstructorId,
      }),
      ...(body.room !== undefined && { room: body.room }),
      ...(body.capacity && { capacity: Number(body.capacity) }),
      ...(body.workshopPrice !== undefined && {
        workshopPrice: body.workshopPrice,
      }),
      ...(body.description !== undefined && { description: body.description }),
    },
    include: {
      instructor: { select: { fullName: true } },
    },
  });

  await audit({
    actorId: user.id,
    action: AUDIT_ACTIONS.CLASS_SESSION_UPDATED,
    entityType: "class_session",
    entityId: params.id,
    oldValue: old as Record<string, unknown>,
    newValue: body,
  });

  // Notify all booked clients if instructor changed
  if (instructorChanging) {
    void notifyInstructorChange(params.id, session.title, session.startTime, updated.instructor.fullName);
  }

  return apiSuccess(updated);
}

// ─── DELETE /api/classes/[id] — soft cancel, not delete ──────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorised", 401);

  const profile = await prisma.profile.findUnique({ where: { id: user.id } });
  if (!profile || profile.role !== "founder") {
    return apiError("Only founders can cancel classes", 403);
  }

  const body = await request.json().catch(() => ({}));
  const reason = body.reason ?? "Class cancelled by studio";

  const session = await prisma.classSession.findUnique({
    where: { id: params.id },
    include: {
      bookings: {
        where: { status: { in: ["confirmed"] } },
        include: {
          client: { select: { fullName: true, phone: true } },
          clientPackage: true,
        },
      },
    },
  });

  if (!session) return apiError("Class not found", 404);
  if (session.status === "cancelled") return apiError("Class is already cancelled");

  // Cancel session + restore all confirmed booking credits
  await prisma.$transaction(async (tx) => {
    await tx.classSession.update({
      where: { id: params.id },
      data: {
        status: "cancelled",
        cancellationReason: reason,
        cancelledAt: new Date(),
        cancelledById: user.id,
      },
    });

    // Restore credits for all confirmed bookings
    for (const booking of session.bookings) {
      await tx.booking.update({
        where: { id: booking.id },
        data: { status: "cancelled", cancellationReason: reason, cancelledAt: new Date() },
      });

      if (booking.creditDeducted && !booking.creditRestored && booking.clientPackageId) {
        await tx.clientPackage.update({
          where: { id: booking.clientPackageId },
          data: {
            usedCredits: { decrement: 1 },
            remainingCredits: { increment: 1 },
          },
        });
        await tx.booking.update({
          where: { id: booking.id },
          data: { creditRestored: true },
        });
      }
    }
  });

  await audit({
    actorId: user.id,
    action: AUDIT_ACTIONS.CLASS_SESSION_CANCELLED,
    entityType: "class_session",
    entityId: params.id,
    newValue: { reason, affectedBookings: session.bookings.length },
  });

  // Notify affected clients
  for (const booking of session.bookings) {
    if (booking.client.phone) {
      void sendWhatsAppMessage({
        phone: booking.client.phone,
        message: messages.classCancelled(
          booking.client.fullName,
          session.title,
          formatDateTime(session.startTime)
        ),
        clientId: booking.clientId,
        notificationType: "class_cancelled",
      });
    }
  }

  return apiSuccess({ cancelled: true, creditRestored: session.bookings.length });
}

// ─── Helper: notify clients of instructor change ──────────────────────────────

async function notifyInstructorChange(
  sessionId: string,
  title: string,
  startTime: Date,
  newInstructor: string
) {
  const bookings = await prisma.booking.findMany({
    where: { classSessionId: sessionId, status: { in: ["confirmed"] } },
    include: { client: { select: { fullName: true, phone: true } } },
  });

  for (const b of bookings) {
    if (b.client.phone) {
      await sendWhatsAppMessage({
        phone: b.client.phone,
        message: messages.instructorChange(
          b.client.fullName,
          title,
          formatDateTime(startTime),
          newInstructor
        ),
        clientId: b.clientId,
        notificationType: "instructor_change",
      });
    }
  }
}

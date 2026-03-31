// POST /api/bookings  — create a booking (all business rules enforced)
// GET  /api/bookings  — list bookings (filtered)

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { createBooking } from "@/lib/booking-logic";
import { apiError, apiSuccess } from "@/lib/utils";

// ─── POST /api/bookings ───────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorised", 401);

  const body = await request.json();
  const {
    classSessionId,
    clientId: bodyClientId,
    clientPackageId,
    isGuestBooking,
    guestName,
    guestPhone,
  } = body;

  if (!classSessionId) return apiError("classSessionId is required");

  // Determine who is being booked:
  // - Client booking for themselves: clientId = their own id
  // - Staff/founder booking on behalf of client: clientId = body.clientId
  const profile = await prisma.profile.findUnique({ where: { id: user.id } });
  const isStaff = ["founder", "staff"].includes(profile?.role ?? "");

  let clientId = user.id;
  if (isStaff && bodyClientId) {
    clientId = bodyClientId; // Staff booking on behalf of client
  } else if (!isStaff && bodyClientId && bodyClientId !== user.id) {
    return apiError("You can only book for yourself", 403);
  }

  const result = await createBooking({
    clientId,
    classSessionId,
    clientPackageId,
    isGuestBooking: Boolean(isGuestBooking),
    guestName,
    guestPhone,
    actorId: user.id,
    ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
  });

  if (!result.success) return apiError(result.error ?? "Booking failed");

  // Return the right response based on outcome
  if (result.waitlistEntry) {
    return apiSuccess(
      {
        waitlisted: true,
        position: result.waitlistEntry.position,
        message: `You've been added to the waitlist at position ${result.waitlistEntry.position}.`,
      },
      200
    );
  }

  return apiSuccess(
    {
      booking: result.booking,
      creditDeducted: result.creditDeducted,
      message: "Booking confirmed!",
    },
    201
  );
}

// ─── GET /api/bookings ────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorised", 401);

  const profile = await prisma.profile.findUnique({ where: { id: user.id } });
  const isStaff = ["founder", "staff"].includes(profile?.role ?? "");
  const isInstructor = profile?.role === "instructor";

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId");
  const classSessionId = searchParams.get("classSessionId");
  const status = searchParams.get("status");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  // Clients can only see their own bookings
  if (!isStaff && !isInstructor && clientId && clientId !== user.id) {
    return apiError("Forbidden", 403);
  }

  const where: Record<string, unknown> = {};

  if (clientId) {
    where.clientId = clientId;
  } else if (!isStaff) {
    where.clientId = user.id; // Default: own bookings
  }

  if (classSessionId) where.classSessionId = classSessionId;
  if (status) where.status = status;
  if (from || to) {
    where.classSession = {
      startTime: {
        ...(from && { gte: new Date(from) }),
        ...(to && { lte: new Date(to) }),
      },
    };
  }

  const bookings = await prisma.booking.findMany({
    where,
    include: {
      classSession: {
        select: {
          id: true,
          title: true,
          startTime: true,
          endTime: true,
          room: true,
          category: { select: { name: true, color: true } },
          instructor: { select: { fullName: true } },
        },
      },
      client: { select: { id: true, fullName: true, phone: true } },
      clientPackage: {
        select: {
          package: { select: { name: true } },
          remainingCredits: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return apiSuccess(bookings);
}

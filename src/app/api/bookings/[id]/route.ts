// PATCH /api/bookings/[id]  — cancel, mark no-show, mark attended

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { cancelBooking, markAttendance } from "@/lib/booking-logic";
import { apiError, apiSuccess } from "@/lib/utils";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorised", 401);

  const body = await request.json();
  const { action, reason } = body;

  if (!action) return apiError("action is required: 'cancel' | 'attend' | 'no_show'");

  const booking = await prisma.booking.findUnique({
    where: { id: params.id },
    include: { client: { select: { id: true } } },
  });

  if (!booking) return apiError("Booking not found", 404);

  const profile = await prisma.profile.findUnique({ where: { id: user.id } });
  const isStaff = ["founder", "staff"].includes(profile?.role ?? "");
  const isInstructor = profile?.role === "instructor";
  const isOwner = booking.clientId === user.id;

  // Clients can only cancel their own bookings
  if (action === "cancel" && !isStaff && !isOwner) {
    return apiError("Forbidden", 403);
  }
  // Attendance marking: staff or instructor only
  if ((action === "attend" || action === "no_show") && !isStaff && !isInstructor) {
    return apiError("Only staff or instructors can mark attendance", 403);
  }

  if (action === "cancel") {
    const result = await cancelBooking(params.id, reason, user.id);
    if (!result.success) return apiError(result.error ?? "Cancel failed");
    return apiSuccess({
      cancelled: true,
      creditRestored: result.creditRestored,
      lateCancellation: result.lateCancellation,
      message: result.lateCancellation
        ? "Booking cancelled (late cancellation — credit was not returned)."
        : `Booking cancelled.${result.creditRestored ? " Credit has been returned." : ""}`,
    });
  }

  if (action === "attend") {
    const result = await markAttendance(params.id, true, user.id);
    if (!result.success) return apiError(result.error ?? "Failed to mark attendance");
    return apiSuccess({ attended: true });
  }

  if (action === "no_show") {
    const result = await markAttendance(params.id, false, user.id);
    if (!result.success) return apiError(result.error ?? "Failed to mark no-show");
    return apiSuccess({ noShow: true });
  }

  return apiError("Invalid action. Use: cancel | attend | no_show");
}

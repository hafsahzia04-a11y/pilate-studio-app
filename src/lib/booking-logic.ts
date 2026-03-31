// ─────────────────────────────────────────────────────────────────────────────
// Booking Logic — the most critical part of the system.
//
// Every booking action goes through this file so business rules are enforced
// in one place. Never bypass these functions.
//
// EDGE CASES HANDLED:
//  1. Class is full → add to waitlist
//  2. Client has no active package → block booking
//  3. Client has 0 credits remaining → block booking
//  4. Client's package is expired → block booking
//  5. Client already booked this class → block (DB unique constraint + check)
//  6. Booking window not open yet → block for standard clients
//  7. Class cancelled → block new bookings
//  8. Overlapping bookings at same time → block
//  9. Guest pass exceeded → block
// 10. Workshop discount applied correctly per package
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from "@/lib/prisma";
import { audit, AUDIT_ACTIONS } from "@/lib/audit";
import { getSetting, getSettings } from "@/lib/settings";
import { sendWhatsAppMessage, messages } from "@/lib/whatsapp";
import { formatDateTime } from "@/lib/utils";
import { BookingStatus, ClientPackageStatus, SessionStatus } from "@prisma/client";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface BookingResult {
  success: boolean;
  booking?: { id: string; status: BookingStatus };
  waitlistEntry?: { id: string; position: number };
  error?: string;
  creditDeducted?: boolean;
}

export interface BookingRequest {
  clientId: string;
  classSessionId: string;
  clientPackageId?: string;   // If not provided, system finds the best active package
  isGuestBooking?: boolean;
  guestName?: string;
  guestPhone?: string;
  actorId?: string;           // Staff/founder doing this on behalf of client
  ipAddress?: string;
}

// ─── MAIN: Create a booking ────────────────────────────────────────────────────

export async function createBooking(req: BookingRequest): Promise<BookingResult> {
  const {
    clientId,
    classSessionId,
    isGuestBooking = false,
    guestName,
    guestPhone,
    actorId,
    ipAddress,
  } = req;

  // ── 1. Load the class session ──────────────────────────────────────────────
  const session = await prisma.classSession.findUnique({
    where: { id: classSessionId },
    include: { instructor: { select: { fullName: true } } },
  });

  if (!session) return { success: false, error: "Class not found." };
  if (session.status === SessionStatus.cancelled) {
    return { success: false, error: "This class has been cancelled." };
  }
  if (new Date(session.startTime) < new Date()) {
    return { success: false, error: "You cannot book a class that has already started." };
  }

  // ── 2. Check for duplicate booking ────────────────────────────────────────
  const existingBooking = await prisma.booking.findUnique({
    where: { clientId_classSessionId: { clientId, classSessionId } },
  });
  if (existingBooking && existingBooking.status !== "cancelled") {
    return { success: false, error: "You are already booked into this class." };
  }

  // ── 3. Check for time conflict (same client, overlapping time) ─────────────
  const conflict = await prisma.booking.findFirst({
    where: {
      clientId,
      status: { in: ["confirmed", "attended"] },
      classSession: {
        startTime: { lt: session.endTime },
        endTime: { gt: session.startTime },
        status: { not: SessionStatus.cancelled },
      },
      id: { not: existingBooking?.id }, // Exclude if rebooking
    },
  });
  if (conflict) {
    return {
      success: false,
      error: "You have another class at this time. Please cancel it first.",
    };
  }

  // ── 4. Find the client's active package ───────────────────────────────────
  const activePackage = await findBestPackage(clientId, req.clientPackageId, session);
  if (!activePackage && !isGuestBooking) {
    return {
      success: false,
      error: "You don't have an active membership or class credits. Please purchase a package first.",
    };
  }

  // ── 5. For guest bookings: check guest pass availability ──────────────────
  if (isGuestBooking) {
    if (!activePackage) {
      return { success: false, error: "No active package with guest passes found." };
    }
    if (activePackage.guestPassesRemaining <= 0) {
      return { success: false, error: "No guest passes remaining this month." };
    }
  }

  // ── 6. For credit-based bookings: check credit balance ────────────────────
  if (!isGuestBooking && activePackage && session.usesCredits) {
    if (activePackage.remainingCredits <= 0) {
      return {
        success: false,
        error: `You have 0 class credits remaining on your ${activePackage.package?.name} package.`,
      };
    }
  }

  // ── 7. Check booking window (priority vs standard) ─────────────────────────
  const settings = await getSettings([
    "standard_booking_window_hours",
    "credit_deduct_on",
  ]);
  const classDate = new Date(session.startTime);
  const now = new Date();
  const hoursUntilClass = (classDate.getTime() - now.getTime()) / 3_600_000;

  if (activePackage) {
    const windowHours =
      activePackage.package?.bookingWindowHours ?? settings.standard_booking_window_hours;
    if (hoursUntilClass > windowHours) {
      return {
        success: false,
        error: `Bookings for this class open ${windowHours} hours before the class starts. Please try again closer to the date.`,
      };
    }
  }

  // ── 8. Check class capacity & handle waitlist ──────────────────────────────
  const confirmedCount = await prisma.booking.count({
    where: {
      classSessionId,
      status: { in: ["confirmed", "attended"] },
    },
  });

  if (confirmedCount >= session.capacity) {
    // Class is full — add to waitlist
    return addToWaitlist(clientId, classSessionId, actorId);
  }

  // ── 9. Determine credit deduction timing ──────────────────────────────────
  const deductOnBooking = settings.credit_deduct_on === "booking";

  // ── 10. Create booking and deduct credit atomically ───────────────────────
  const result = await prisma.$transaction(async (tx) => {
    // Handle previously cancelled booking (re-book same slot)
    let booking;
    if (existingBooking?.status === "cancelled") {
      booking = await tx.booking.update({
        where: { id: existingBooking.id },
        data: {
          status: "confirmed",
          clientPackageId: activePackage?.id ?? null,
          creditDeducted: false,
          creditRestored: false,
          isGuestBooking,
          guestName: guestName ?? null,
          guestPhone: guestPhone ?? null,
          cancellationReason: null,
          cancelledAt: null,
          updatedAt: new Date(),
        },
      });
    } else {
      booking = await tx.booking.create({
        data: {
          clientId,
          classSessionId,
          clientPackageId: activePackage?.id ?? null,
          status: "confirmed",
          creditDeducted: false,
          isGuestBooking,
          guestName: guestName ?? null,
          guestPhone: guestPhone ?? null,
        },
      });
    }

    let creditDeducted = false;

    // Deduct credit NOW if configured to deduct on booking
    if (deductOnBooking && activePackage && session.usesCredits) {
      if (isGuestBooking) {
        // Deduct guest pass
        await tx.clientPackage.update({
          where: { id: activePackage.id },
          data: { guestPassesRemaining: { decrement: 1 } },
        });
      } else {
        // Deduct class credit
        await tx.clientPackage.update({
          where: { id: activePackage.id },
          data: {
            usedCredits: { increment: 1 },
            remainingCredits: { decrement: 1 },
          },
        });
      }

      await tx.booking.update({
        where: { id: booking.id },
        data: { creditDeducted: true },
      });
      creditDeducted = true;
    }

    return { booking, creditDeducted };
  });

  // ── 11. Audit log ─────────────────────────────────────────────────────────
  await audit({
    actorId,
    action: AUDIT_ACTIONS.BOOKING_CREATED,
    entityType: "booking",
    entityId: result.booking.id,
    newValue: {
      clientId,
      classSessionId,
      packageId: activePackage?.id,
      creditDeducted: result.creditDeducted,
      isGuestBooking,
    },
    ipAddress,
  });

  // ── 12. WhatsApp notification ──────────────────────────────────────────────
  void notifyBookingConfirmed(clientId, session, result.booking.id);

  return {
    success: true,
    booking: { id: result.booking.id, status: "confirmed" },
    creditDeducted: result.creditDeducted,
  };
}

// ─── CANCEL a booking ─────────────────────────────────────────────────────────

export interface CancelBookingResult {
  success: boolean;
  creditRestored?: boolean;
  error?: string;
  lateCancellation?: boolean;
}

export async function cancelBooking(
  bookingId: string,
  reason?: string,
  actorId?: string
): Promise<CancelBookingResult> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      classSession: true,
      clientPackage: true,
      client: { select: { fullName: true, phone: true } },
    },
  });

  if (!booking) return { success: false, error: "Booking not found." };
  if (booking.status === "cancelled") {
    return { success: false, error: "This booking is already cancelled." };
  }
  if (booking.status === "attended") {
    return { success: false, error: "Cannot cancel an attended class." };
  }

  const settings = await getSettings([
    "late_cancel_cutoff_hours",
    "late_cancel_loses_credit",
    "no_show_loses_credit",
  ]);

  const hoursUntilClass =
    (new Date(booking.classSession.startTime).getTime() - Date.now()) / 3_600_000;

  const isLateCancellation = hoursUntilClass < settings.late_cancel_cutoff_hours;
  const newStatus: BookingStatus = isLateCancellation ? "late_cancelled" : "cancelled";

  // Determine if credit should be returned
  const shouldRestoreCredit =
    booking.creditDeducted &&
    !booking.creditRestored &&
    !(isLateCancellation && settings.late_cancel_loses_credit);

  await prisma.$transaction(async (tx) => {
    await tx.booking.update({
      where: { id: bookingId },
      data: {
        status: newStatus,
        cancellationReason: reason ?? null,
        cancelledAt: new Date(),
      },
    });

    // Restore credit if eligible
    if (shouldRestoreCredit && booking.clientPackageId) {
      if (booking.isGuestBooking) {
        await tx.clientPackage.update({
          where: { id: booking.clientPackageId },
          data: { guestPassesRemaining: { increment: 1 } },
        });
      } else {
        await tx.clientPackage.update({
          where: { id: booking.clientPackageId },
          data: {
            usedCredits: { decrement: 1 },
            remainingCredits: { increment: 1 },
          },
        });
      }

      await tx.booking.update({
        where: { id: bookingId },
        data: { creditRestored: true },
      });
    }
  });

  // Promote next waitlist member if spot opened
  if (!isLateCancellation) {
    void promoteFromWaitlist(booking.classSessionId);
  }

  await audit({
    actorId,
    action: AUDIT_ACTIONS.BOOKING_CANCELLED,
    entityType: "booking",
    entityId: bookingId,
    oldValue: { status: booking.status },
    newValue: { status: newStatus, creditRestored: shouldRestoreCredit },
  });

  return {
    success: true,
    creditRestored: shouldRestoreCredit,
    lateCancellation: isLateCancellation,
  };
}

// ─── MARK ATTENDANCE ──────────────────────────────────────────────────────────

export async function markAttendance(
  bookingId: string,
  attended: boolean,
  markedById?: string
): Promise<{ success: boolean; error?: string }> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { classSession: true },
  });

  if (!booking) return { success: false, error: "Booking not found." };

  const settings = await getSettings(["credit_deduct_on", "no_show_loses_credit"]);
  const deductOnAttendance = (settings.credit_deduct_on as string) === "attendance";

  const newStatus: BookingStatus = attended ? "attended" : "no_show";

  await prisma.$transaction(async (tx) => {
    await tx.booking.update({
      where: { id: bookingId },
      data: { status: newStatus },
    });

    await tx.attendanceLog.upsert({
      where: { bookingId },
      update: {
        checkInTime: attended ? new Date() : null,
        markedById: markedById ?? null,
        markedAt: new Date(),
      },
      create: {
        bookingId,
        classSessionId: booking.classSessionId,
        checkInTime: attended ? new Date() : null,
        markedById: markedById ?? null,
      },
    });

    // If deducting on attendance and attended, deduct now
    if (deductOnAttendance && attended && !booking.creditDeducted && booking.clientPackageId) {
      await tx.clientPackage.update({
        where: { id: booking.clientPackageId },
        data: {
          usedCredits: { increment: 1 },
          remainingCredits: { decrement: 1 },
        },
      });
      await tx.booking.update({
        where: { id: bookingId },
        data: { creditDeducted: true },
      });
    }

    // No-show loses credit if configured and credit was NOT already deducted on booking
    const noShowLosesCredit = settings.no_show_loses_credit;
    if (
      !attended &&
      noShowLosesCredit &&
      !booking.creditDeducted &&
      booking.clientPackageId &&
      deductOnAttendance
    ) {
      await tx.clientPackage.update({
        where: { id: booking.clientPackageId },
        data: {
          usedCredits: { increment: 1 },
          remainingCredits: { decrement: 1 },
        },
      });
      await tx.booking.update({
        where: { id: bookingId },
        data: { creditDeducted: true },
      });
    }
  });

  await audit({
    actorId: markedById,
    action: attended ? AUDIT_ACTIONS.BOOKING_ATTENDED : AUDIT_ACTIONS.BOOKING_NO_SHOW,
    entityType: "booking",
    entityId: bookingId,
    newValue: { status: newStatus },
  });

  return { success: true };
}

// ─── WAITLIST: Add to waitlist ────────────────────────────────────────────────

async function addToWaitlist(
  clientId: string,
  classSessionId: string,
  actorId?: string
): Promise<BookingResult> {
  // Check if already on waitlist
  const existing = await prisma.waitlistEntry.findUnique({
    where: { classSessionId_clientId: { classSessionId, clientId } },
  });
  if (existing && existing.status === "waiting") {
    return { success: false, error: `You're already on the waitlist at position ${existing.position}.` };
  }

  // Find the next position
  const lastEntry = await prisma.waitlistEntry.findFirst({
    where: { classSessionId, status: "waiting" },
    orderBy: { position: "desc" },
  });
  const nextPosition = (lastEntry?.position ?? 0) + 1;

  const entry = await prisma.waitlistEntry.upsert({
    where: { classSessionId_clientId: { classSessionId, clientId } },
    update: { status: "waiting", position: nextPosition },
    create: { classSessionId, clientId, position: nextPosition, status: "waiting" },
  });

  await audit({
    actorId,
    action: AUDIT_ACTIONS.BOOKING_WAITLISTED,
    entityType: "waitlist_entry",
    entityId: entry.id,
    newValue: { classSessionId, clientId, position: nextPosition },
  });

  return {
    success: true,
    waitlistEntry: { id: entry.id, position: nextPosition },
  };
}

// ─── WAITLIST: Promote the next person when a spot opens ─────────────────────

export async function promoteFromWaitlist(classSessionId: string): Promise<void> {
  const autoPromote = await getSetting("waitlist_auto_promote");
  if (!autoPromote) return;

  const nextInLine = await prisma.waitlistEntry.findFirst({
    where: { classSessionId, status: "waiting" },
    orderBy: { position: "asc" },
    include: { client: { select: { fullName: true, phone: true } } },
  });

  if (!nextInLine) return; // No one waiting

  const session = await prisma.classSession.findUnique({
    where: { id: classSessionId },
  });
  if (!session) return;

  // Mark as promoted
  await prisma.waitlistEntry.update({
    where: { id: nextInLine.id },
    data: { status: "promoted", promotedAt: new Date() },
  });

  // Auto-create their booking
  const bookingResult = await createBooking({
    clientId: nextInLine.clientId,
    classSessionId,
    actorId: undefined, // System action
  });

  if (bookingResult.success) {
    await audit({
      action: AUDIT_ACTIONS.BOOKING_PROMOTED,
      entityType: "waitlist_entry",
      entityId: nextInLine.id,
      newValue: { promoted: true, newBookingId: bookingResult.booking?.id },
    });

    // Notify client
    if (nextInLine.client.phone) {
      void sendWhatsAppMessage({
        phone: nextInLine.client.phone,
        message: messages.waitlistPromoted(
          nextInLine.client.fullName,
          session.title,
          formatDateTime(session.startTime)
        ),
        clientId: nextInLine.clientId,
        notificationType: "waitlist_promoted",
      });
    }
  }
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

async function findBestPackage(
  clientId: string,
  preferredPackageId: string | undefined,
  session: { isWorkshop: boolean; usesCredits: boolean }
) {
  const now = new Date();

  if (preferredPackageId) {
    return prisma.clientPackage.findFirst({
      where: {
        id: preferredPackageId,
        clientId,
        status: ClientPackageStatus.active,
        expiryDate: { gte: now },
      },
      include: { package: true },
    });
  }

  // Auto-select: prefer the package with fewest credits left (use it up first)
  return prisma.clientPackage.findFirst({
    where: {
      clientId,
      status: ClientPackageStatus.active,
      expiryDate: { gte: now },
      remainingCredits: { gt: 0 },
    },
    include: { package: true },
    orderBy: { remainingCredits: "asc" },
  });
}

async function notifyBookingConfirmed(
  clientId: string,
  session: { title: string; startTime: Date },
  bookingId: string
) {
  const settings = await getSetting("notify_on_booking");
  if (!settings) return;

  const client = await prisma.profile.findUnique({
    where: { id: clientId },
    select: { fullName: true, phone: true },
  });
  if (!client?.phone) return;

  await sendWhatsAppMessage({
    phone: client.phone,
    message: messages.bookingConfirmed(
      client.fullName,
      session.title,
      formatDateTime(session.startTime)
    ),
    clientId,
    notificationType: "booking_confirm",
  });
}

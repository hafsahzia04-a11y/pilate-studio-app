// GET   /api/packages/[id]  — package detail
// PATCH /api/packages/[id]  — update package (founder only)
// POST  /api/packages/[id]/sell — sell this package to a client

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { audit, AUDIT_ACTIONS } from "@/lib/audit";
import { apiError, apiSuccess } from "@/lib/utils";
import { activateClientPackage } from "@/lib/credit-logic";
import { addDays } from "date-fns";
import { sendWhatsAppMessage, messages } from "@/lib/whatsapp";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const pkg = await prisma.package.findUnique({
    where: { id: params.id },
    include: {
      clientPackages: {
        where: { status: { in: ["active", "paused"] } },
        include: {
          client: { select: { id: true, fullName: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      _count: { select: { clientPackages: true } },
    },
  });
  if (!pkg) return apiError("Package not found", 404);
  return apiSuccess({ ...pkg, price: Number(pkg.price) });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorised", 401);

  const profile = await prisma.profile.findUnique({ where: { id: user.id } });
  if (profile?.role !== "founder") return apiError("Founders only", 403);

  const old = await prisma.package.findUnique({ where: { id: params.id } });
  if (!old) return apiError("Package not found", 404);

  const body = await request.json();

  // IMPORTANT: Editing a package does NOT retroactively change existing client packages.
  // Only new purchases use the updated rules.
  // Founders are warned of this in the UI.

  const updated = await prisma.package.update({
    where: { id: params.id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.price !== undefined && { price: Number(body.price) }),
      ...(body.classCredits !== undefined && { classCredits: Number(body.classCredits) }),
      ...(body.validityDays !== undefined && { validityDays: Number(body.validityDays) }),
      ...(body.guestPassesPerPeriod !== undefined && {
        guestPassesPerPeriod: Number(body.guestPassesPerPeriod),
      }),
      ...(body.workshopDiscountPercent !== undefined && {
        workshopDiscountPercent: Number(body.workshopDiscountPercent),
      }),
      ...(body.drinksPerPeriod !== undefined && {
        drinksPerPeriod: Number(body.drinksPerPeriod),
      }),
      ...(body.bookingWindowHours !== undefined && {
        bookingWindowHours: body.bookingWindowHours ? Number(body.bookingWindowHours) : null,
      }),
      ...(body.priorityBooking !== undefined && { priorityBooking: Boolean(body.priorityBooking) }),
      ...(body.isActive !== undefined && { isActive: Boolean(body.isActive) }),
      ...(body.isVisible !== undefined && { isVisible: Boolean(body.isVisible) }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.maxQuantity !== undefined && {
        maxQuantity: body.maxQuantity ? Number(body.maxQuantity) : null,
      }),
      ...(body.sortOrder !== undefined && { sortOrder: Number(body.sortOrder) }),
    },
  });

  await audit({
    actorId: user.id,
    action: AUDIT_ACTIONS.PACKAGE_UPDATED,
    entityType: "package",
    entityId: params.id,
    oldValue: old as Record<string, unknown>,
    newValue: body,
  });

  return apiSuccess({ ...updated, price: Number(updated.price) });
}

// ─── POST /api/packages/[id]/sell — assign package to a client ────────────────
// This is a sub-route, accessed via /api/packages/[id]?action=sell

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorised", 401);

  const profile = await prisma.profile.findUnique({ where: { id: user.id } });
  if (!["founder", "staff"].includes(profile?.role ?? "")) {
    return apiError("Only founders and staff can sell packages", 403);
  }

  const pkg = await prisma.package.findUnique({ where: { id: params.id } });
  if (!pkg) return apiError("Package not found", 404);
  if (!pkg.isActive) return apiError("This package is not currently active");

  // Check founding member limit
  if (pkg.isFounding && pkg.maxQuantity) {
    if (pkg.soldCount >= pkg.maxQuantity) {
      return apiError("Founding member spots are sold out");
    }
  }

  const body = await request.json();
  const { clientId, startDate, paymentMethod, amountPaid, notes } = body;

  if (!clientId) return apiError("clientId is required");

  const start = startDate ? new Date(startDate) : new Date();
  const expiry = addDays(start, pkg.validityDays);

  // For founding members: calculate price lock expiry
  const lockExpiry =
    pkg.priceLockMonths > 0
      ? new Date(start.getFullYear(), start.getMonth() + pkg.priceLockMonths, start.getDate())
      : null;

  const amountPaidNum = Number(amountPaid ?? 0);
  const amountDue = Number(pkg.price);
  const outstanding = amountDue - amountPaidNum;

  const clientPackage = await prisma.$transaction(async (tx) => {
    const cp = await tx.clientPackage.create({
      data: {
        clientId,
        packageId: pkg.id,
        startDate: start,
        expiryDate: expiry,
        renewalDate: pkg.type === "membership" ? expiry : null,
        totalCredits: pkg.classCredits,
        usedCredits: 0,
        remainingCredits: pkg.classCredits,
        guestPassesRemaining: pkg.guestPassesPerPeriod,
        drinksRemaining: pkg.drinksPerPeriod,
        lastPerkResetDate: start,
        lockedPrice: pkg.isFounding ? pkg.price : null,
        lockExpiresAt: lockExpiry,
        amountPaid: amountPaidNum,
        amountDue,
        paymentStatus: outstanding <= 0 ? "paid" : amountPaidNum > 0 ? "partial" : "unpaid",
        paymentDueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // Due in 3 days
        status: "active",
        notes: notes ?? null,
        createdById: user.id,
      },
    });

    // Record the payment if any was made
    if (amountPaidNum > 0) {
      await tx.payment.create({
        data: {
          clientId,
          clientPackageId: cp.id,
          amount: amountPaidNum,
          netAmount: amountPaidNum,
          paymentMethod: paymentMethod ?? "cash",
          status: "paid",
          paidAt: new Date(),
          recordedById: user.id,
        },
      });
    }

    // Increment sold count for founding plans
    if (pkg.isFounding) {
      await tx.package.update({
        where: { id: pkg.id },
        data: { soldCount: { increment: 1 } },
      });
    }

    return cp;
  });

  await audit({
    actorId: user.id,
    action: AUDIT_ACTIONS.CLIENT_PACKAGE_PURCHASED,
    entityType: "client_package",
    entityId: clientPackage.id,
    newValue: { clientId, packageId: pkg.id, amountPaid: amountPaidNum },
  });

  // Welcome WhatsApp
  const client = await prisma.profile.findUnique({
    where: { id: clientId },
    select: { fullName: true, phone: true },
  });
  if (client?.phone) {
    void sendWhatsAppMessage({
      phone: client.phone,
      message: messages.welcomeMessage(client.fullName, pkg.name),
      clientId,
      notificationType: "welcome",
    });
  }

  return apiSuccess(clientPackage, 201);
}

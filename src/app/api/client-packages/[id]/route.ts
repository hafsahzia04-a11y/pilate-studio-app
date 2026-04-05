// PATCH /api/client-packages/[id]
// Actions: use_guest_pass | use_drink | record_payment | renew | extend | update_payment_status

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { audit, AUDIT_ACTIONS } from "@/lib/audit";
import { apiError, apiSuccess } from "@/lib/utils";
import { addDays } from "date-fns";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorised", 401);

  const actor = await prisma.profile.findUnique({ where: { id: user.id } });
  const isStaff = ["founder", "staff"].includes(actor?.role ?? "");

  const cp = await prisma.clientPackage.findUnique({
    where: { id: params.id },
    include: {
      package: true,
      payments: { orderBy: { createdAt: "desc" } },
      client: { select: { id: true, fullName: true, phone: true, email: true } },
    },
  });

  if (!cp) return apiError("Client package not found", 404);
  if (!isStaff && cp.clientId !== user.id) return apiError("Forbidden", 403);

  return apiSuccess({
    ...cp,
    amountPaid: Number(cp.amountPaid),
    amountDue: Number(cp.amountDue),
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorised", 401);

  const actor = await prisma.profile.findUnique({ where: { id: user.id } });
  if (!["founder", "staff"].includes(actor?.role ?? "")) {
    return apiError("Only founders and staff can manage client packages", 403);
  }

  const cp = await prisma.clientPackage.findUnique({
    where: { id: params.id },
    include: { package: true, client: { select: { fullName: true, phone: true } } },
  });
  if (!cp) return apiError("Client package not found", 404);

  const body = await request.json();
  const { action } = body;

  // ─── Use guest pass ────────────────────────────────────────────────────────
  if (action === "use_guest_pass") {
    if (cp.guestPassesRemaining <= 0) {
      return apiError("No guest passes remaining");
    }
    const updated = await prisma.clientPackage.update({
      where: { id: params.id },
      data: { guestPassesRemaining: { decrement: 1 } },
    });
    await audit({
      actorId: user.id,
      action: AUDIT_ACTIONS.PRODUCT_REDEEMED,
      entityType: "client_package",
      entityId: params.id,
      newValue: { type: "guest_pass", clientId: cp.clientId, remaining: updated.guestPassesRemaining },
    });
    return apiSuccess({ ...updated, amountPaid: Number(updated.amountPaid), amountDue: Number(updated.amountDue) });
  }

  // ─── Use wellness drink ────────────────────────────────────────────────────
  if (action === "use_drink") {
    if (cp.drinksRemaining <= 0) {
      return apiError("No wellness drinks remaining");
    }
    const updated = await prisma.clientPackage.update({
      where: { id: params.id },
      data: { drinksRemaining: { decrement: 1 } },
    });
    await audit({
      actorId: user.id,
      action: AUDIT_ACTIONS.PRODUCT_REDEEMED,
      entityType: "client_package",
      entityId: params.id,
      newValue: { type: "wellness_drink", clientId: cp.clientId, remaining: updated.drinksRemaining },
    });
    return apiSuccess({ ...updated, amountPaid: Number(updated.amountPaid), amountDue: Number(updated.amountDue) });
  }

  // ─── Record payment ────────────────────────────────────────────────────────
  if (action === "record_payment") {
    const { amount, paymentMethod, notes, referenceNumber } = body;
    if (!amount || Number(amount) <= 0) return apiError("Valid amount is required");

    const amountNum = Number(amount);
    const currentPaid = Number(cp.amountPaid);
    const totalDue = Number(cp.amountDue);
    const newPaid = currentPaid + amountNum;
    const outstanding = totalDue - newPaid;
    const newStatus = outstanding <= 0 ? "paid" : "partial";

    const updated = await prisma.$transaction(async (tx) => {
      const p = await tx.payment.create({
        data: {
          clientId: cp.clientId,
          clientPackageId: params.id,
          amount: amountNum,
          netAmount: amountNum,
          paymentMethod: paymentMethod ?? "cash",
          status: "paid",
          paidAt: new Date(),
          notes: notes ?? null,
          referenceNumber: referenceNumber ?? null,
          recordedById: user.id,
        },
      });
      const upd = await tx.clientPackage.update({
        where: { id: params.id },
        data: {
          amountPaid: newPaid,
          paymentStatus: newStatus,
          status: "active",
        },
      });
      return { payment: p, clientPackage: upd };
    });

    await audit({
      actorId: user.id,
      action: AUDIT_ACTIONS.PAYMENT_RECORDED,
      entityType: "client_package",
      entityId: params.id,
      newValue: { amount: amountNum, paymentMethod, newStatus, clientId: cp.clientId },
    });

    return apiSuccess({
      ...updated.clientPackage,
      amountPaid: Number(updated.clientPackage.amountPaid),
      amountDue: Number(updated.clientPackage.amountDue),
      payment: updated.payment,
    });
  }

  // ─── Renew package ─────────────────────────────────────────────────────────
  if (action === "renew") {
    const { newPackageId, startDate, amountPaid: renewAmountPaid, paymentMethod, notes } = body;

    const pkgId = newPackageId ?? cp.packageId;
    const pkg = await prisma.package.findUnique({ where: { id: pkgId } });
    if (!pkg) return apiError("Package not found");
    if (!pkg.isActive) return apiError("Package is not active");

    const start = startDate ? new Date(startDate) : new Date();
    const expiry = addDays(start, pkg.validityDays);

    const amountPaidNum = Number(renewAmountPaid ?? 0);
    const totalDue = Number(pkg.price);
    const outstanding = totalDue - amountPaidNum;

    const newCp = await prisma.$transaction(async (tx) => {
      // Mark old package expired
      await tx.clientPackage.update({
        where: { id: params.id },
        data: { status: "expired" },
      });

      // Create new package cycle
      const created = await tx.clientPackage.create({
        data: {
          clientId: cp.clientId,
          packageId: pkgId,
          startDate: start,
          expiryDate: expiry,
          renewalDate: pkg.type === "membership" ? expiry : null,
          totalCredits: pkg.classCredits,
          usedCredits: 0,
          remainingCredits: pkg.classCredits,
          guestPassesRemaining: pkg.guestPassesPerPeriod,
          drinksRemaining: pkg.drinksPerPeriod,
          lastPerkResetDate: start,
          amountPaid: amountPaidNum,
          amountDue: totalDue,
          paymentStatus: outstanding <= 0 ? "paid" : amountPaidNum > 0 ? "partial" : "unpaid",
          paymentDueDate: expiry,
          status: "active",
          notes: notes ?? null,
          createdById: user.id,
        },
      });

      if (amountPaidNum > 0) {
        await tx.payment.create({
          data: {
            clientId: cp.clientId,
            clientPackageId: created.id,
            amount: amountPaidNum,
            netAmount: amountPaidNum,
            paymentMethod: paymentMethod ?? "cash",
            status: "paid",
            paidAt: new Date(),
            recordedById: user.id,
          },
        });
      }

      return created;
    });

    await audit({
      actorId: user.id,
      action: AUDIT_ACTIONS.CLIENT_PACKAGE_PURCHASED,
      entityType: "client_package",
      entityId: newCp.id,
      newValue: { renewal: true, oldPackageId: cp.id, clientId: cp.clientId, packageId: pkgId },
    });

    return apiSuccess({ ...newCp, amountPaid: Number(newCp.amountPaid), amountDue: Number(newCp.amountDue) }, 201);
  }

  // ─── Extend validity ───────────────────────────────────────────────────────
  if (action === "extend") {
    const { newExpiryDate, reason } = body;
    if (!newExpiryDate) return apiError("newExpiryDate is required");

    const updated = await prisma.clientPackage.update({
      where: { id: params.id },
      data: {
        expiryDate: new Date(newExpiryDate),
        renewalDate: new Date(newExpiryDate),
        status: "active",
      },
    });

    await audit({
      actorId: user.id,
      action: AUDIT_ACTIONS.CLIENT_PACKAGE_VALIDITY_EXTENDED,
      entityType: "client_package",
      entityId: params.id,
      newValue: { newExpiryDate, reason, clientId: cp.clientId },
    });

    return apiSuccess({ ...updated, amountPaid: Number(updated.amountPaid), amountDue: Number(updated.amountDue) });
  }

  // ─── Set perk quantities manually ─────────────────────────────────────────
  if (action === "set_perks") {
    const { guestPassesRemaining, drinksRemaining } = body;

    const updateData: { guestPassesRemaining?: number; drinksRemaining?: number } = {};

    if (guestPassesRemaining !== undefined) {
      const val = Number(guestPassesRemaining);
      if (!Number.isInteger(val) || val < 0) return apiError("guestPassesRemaining must be a non-negative integer");
      updateData.guestPassesRemaining = val;
    }

    if (drinksRemaining !== undefined) {
      const val = Number(drinksRemaining);
      if (!Number.isInteger(val) || val < 0) return apiError("drinksRemaining must be a non-negative integer");
      updateData.drinksRemaining = val;
    }

    if (Object.keys(updateData).length === 0) {
      return apiError("At least one of guestPassesRemaining or drinksRemaining is required");
    }

    const updated = await prisma.clientPackage.update({
      where: { id: params.id },
      data: updateData,
    });

    await audit({
      actorId: user.id,
      action: AUDIT_ACTIONS.PRODUCT_REDEEMED,
      entityType: "client_package",
      entityId: params.id,
      newValue: { type: "set_perks", clientId: cp.clientId, ...updateData },
    });

    return apiSuccess({ ...updated, amountPaid: Number(updated.amountPaid), amountDue: Number(updated.amountDue) });
  }

  return apiError("Invalid action. Valid actions: use_guest_pass, use_drink, record_payment, renew, extend, set_perks");
}

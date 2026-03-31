// ─────────────────────────────────────────────────────────────────────────────
// Credit Logic — manual adjustments, package activation, perk resets
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from "@/lib/prisma";
import { audit, AUDIT_ACTIONS } from "@/lib/audit";

// ─── Manually adjust a client's remaining credits (founder/staff action) ──────

export async function adjustCredits(
  clientPackageId: string,
  adjustment: number,    // Positive = add credits, negative = remove credits
  reason: string,
  actorId: string
): Promise<{ success: boolean; newRemaining?: number; error?: string }> {
  const pkg = await prisma.clientPackage.findUnique({
    where: { id: clientPackageId },
  });

  if (!pkg) return { success: false, error: "Package not found." };

  const newRemaining = pkg.remainingCredits + adjustment;
  if (newRemaining < 0) {
    return { success: false, error: "Cannot reduce credits below zero." };
  }

  const newUsed = pkg.usedCredits - adjustment; // If adding credits, used goes down
  const newTotal = pkg.totalCredits + Math.max(0, adjustment); // Only increase total if adding

  await prisma.$transaction(async (tx) => {
    await tx.clientPackage.update({
      where: { id: clientPackageId },
      data: {
        remainingCredits: newRemaining,
        usedCredits: Math.max(0, newUsed),
        totalCredits: adjustment > 0 ? { increment: adjustment } : pkg.totalCredits,
      },
    });
  });

  await audit({
    actorId,
    action: AUDIT_ACTIONS.CREDIT_MANUALLY_ADJUSTED,
    entityType: "client_package",
    entityId: clientPackageId,
    oldValue: {
      remainingCredits: pkg.remainingCredits,
      usedCredits: pkg.usedCredits,
      totalCredits: pkg.totalCredits,
    },
    newValue: {
      remainingCredits: newRemaining,
      adjustment,
      reason,
    },
  });

  return { success: true, newRemaining };
}

// ─── Activate a client package (set to active, record initial credits) ─────────

export async function activateClientPackage(
  clientPackageId: string,
  actorId?: string
): Promise<{ success: boolean; error?: string }> {
  const pkg = await prisma.clientPackage.findUnique({
    where: { id: clientPackageId },
    include: { package: true },
  });

  if (!pkg) return { success: false, error: "Package not found." };
  if (pkg.status === "active") return { success: false, error: "Package is already active." };

  await prisma.clientPackage.update({
    where: { id: clientPackageId },
    data: {
      status: "active",
      remainingCredits: pkg.totalCredits,
      guestPassesRemaining: pkg.package.guestPassesPerPeriod,
      drinksRemaining: pkg.package.drinksPerPeriod,
      lastPerkResetDate: new Date(),
    },
  });

  await audit({
    actorId,
    action: AUDIT_ACTIONS.CLIENT_PACKAGE_PURCHASED,
    entityType: "client_package",
    entityId: clientPackageId,
    newValue: { status: "active", totalCredits: pkg.totalCredits },
  });

  return { success: true };
}

// ─── Monthly perk reset (run this via cron on 1st of each month) ──────────────
// Resets guest passes and complimentary drinks for active monthly memberships.

export async function resetMonthlyPerks(): Promise<{ resetCount: number }> {
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  // Find active memberships whose perks haven't been reset this month
  const packages = await prisma.clientPackage.findMany({
    where: {
      status: "active",
      lastPerkResetDate: { lt: startOfMonth },
      package: {
        type: { in: ["membership", "founding"] },
      },
    },
    include: { package: true },
  });

  let resetCount = 0;

  for (const pkg of packages) {
    if (
      pkg.package.guestPassesPerPeriod > 0 ||
      pkg.package.drinksPerPeriod > 0 ||
      pkg.package.classCredits > 0
    ) {
      await prisma.clientPackage.update({
        where: { id: pkg.id },
        data: {
          // For monthly memberships, reset ALL credits (not cumulative)
          totalCredits: pkg.package.classCredits,
          usedCredits: 0,
          remainingCredits: pkg.package.classCredits,
          guestPassesRemaining: pkg.package.guestPassesPerPeriod,
          drinksRemaining: pkg.package.drinksPerPeriod,
          lastPerkResetDate: today,
        },
      });
      resetCount++;
    }
  }

  console.log(`[CronJob] Monthly perk reset: ${resetCount} packages updated`);
  return { resetCount };
}

// ─── Freeze / Pause a membership ─────────────────────────────────────────────
// Extends the expiry by the number of freeze days.

export async function freezeMembership(params: {
  clientPackageId: string;
  freezeStart: Date;
  freezeEnd: Date;
  reason: string;
  approvedById: string;
}): Promise<{ success: boolean; newExpiry?: Date; error?: string }> {
  const { clientPackageId, freezeStart, freezeEnd, reason, approvedById } = params;

  const pkg = await prisma.clientPackage.findUnique({
    where: { id: clientPackageId },
  });

  if (!pkg) return { success: false, error: "Package not found." };
  if (pkg.status !== "active") {
    return { success: false, error: "Only active packages can be frozen." };
  }

  const freezeDays = Math.ceil(
    (freezeEnd.getTime() - freezeStart.getTime()) / (1000 * 60 * 60 * 24)
  );

  const originalExpiry = pkg.expiryDate;
  const newExpiry = new Date(originalExpiry);
  newExpiry.setDate(newExpiry.getDate() + freezeDays);

  await prisma.$transaction(async (tx) => {
    await tx.clientPackage.update({
      where: { id: clientPackageId },
      data: {
        status: "paused",
        expiryDate: newExpiry,
        pauseStart: freezeStart,
        pauseEnd: freezeEnd,
        pauseReason: reason,
        originalExpiryBeforePause: originalExpiry,
      },
    });

    await tx.membershipFreeze.create({
      data: {
        clientId: pkg.clientId,
        clientPackageId,
        freezeStart,
        freezeEnd,
        reason,
        originalExpiry,
        newExpiry,
        approvedById,
        status: "active",
      },
    });
  });

  await audit({
    actorId: approvedById,
    action: AUDIT_ACTIONS.CLIENT_PACKAGE_PAUSED,
    entityType: "client_package",
    entityId: clientPackageId,
    oldValue: { status: "active", expiryDate: originalExpiry },
    newValue: { status: "paused", expiryDate: newExpiry, freezeDays, reason },
  });

  return { success: true, newExpiry };
}

// ─── Unfreeze / Resume a membership ──────────────────────────────────────────

export async function resumeMembership(
  clientPackageId: string,
  actorId: string
): Promise<{ success: boolean; error?: string }> {
  const pkg = await prisma.clientPackage.findUnique({
    where: { id: clientPackageId },
    include: { membershipFreezes: { where: { status: "active" }, take: 1 } },
  });

  if (!pkg) return { success: false, error: "Package not found." };
  if (pkg.status !== "paused") {
    return { success: false, error: "This membership is not currently paused." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.clientPackage.update({
      where: { id: clientPackageId },
      data: {
        status: "active",
        pauseStart: null,
        pauseEnd: null,
        pauseReason: null,
      },
    });

    // Mark the freeze record as lifted
    if (pkg.membershipFreezes[0]) {
      await tx.membershipFreeze.update({
        where: { id: pkg.membershipFreezes[0].id },
        data: { status: "lifted" },
      });
    }
  });

  await audit({
    actorId,
    action: AUDIT_ACTIONS.CLIENT_PACKAGE_RESUMED,
    entityType: "client_package",
    entityId: clientPackageId,
    newValue: { status: "active" },
  });

  return { success: true };
}

// ─── Extend package validity (manual, by founder) ─────────────────────────────

export async function extendPackageValidity(
  clientPackageId: string,
  extraDays: number,
  reason: string,
  actorId: string
): Promise<{ success: boolean; newExpiry?: Date; error?: string }> {
  const pkg = await prisma.clientPackage.findUnique({
    where: { id: clientPackageId },
  });
  if (!pkg) return { success: false, error: "Package not found." };

  const newExpiry = new Date(pkg.expiryDate);
  newExpiry.setDate(newExpiry.getDate() + extraDays);

  await prisma.clientPackage.update({
    where: { id: clientPackageId },
    data: { expiryDate: newExpiry },
  });

  await audit({
    actorId,
    action: AUDIT_ACTIONS.CLIENT_PACKAGE_VALIDITY_EXTENDED,
    entityType: "client_package",
    entityId: clientPackageId,
    oldValue: { expiryDate: pkg.expiryDate },
    newValue: { expiryDate: newExpiry, extraDays, reason },
  });

  return { success: true, newExpiry };
}

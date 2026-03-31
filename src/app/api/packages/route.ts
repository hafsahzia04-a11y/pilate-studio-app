// GET  /api/packages  — list all packages
// POST /api/packages  — create a package (founder only)

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { audit, AUDIT_ACTIONS } from "@/lib/audit";
import { apiError, apiSuccess } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const activeOnly = searchParams.get("active") !== "false";
  const type = searchParams.get("type");
  const visibleOnly = searchParams.get("visible") === "true";

  const packages = await prisma.package.findMany({
    where: {
      ...(activeOnly && { isActive: true }),
      ...(type && { type: type as never }),
      ...(visibleOnly && { isVisible: true }),
    },
    include: {
      _count: {
        select: {
          clientPackages: {
            where: { status: { in: ["active", "paused"] } },
          },
        },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { price: "asc" }],
  });

  return apiSuccess(
    packages.map((p) => ({
      ...p,
      price: Number(p.price),
      workshopPrice: Number(p.workshopPrice ?? 0),
      activePurchases: p._count.clientPackages,
    }))
  );
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorised", 401);

  const profile = await prisma.profile.findUnique({ where: { id: user.id } });
  if (profile?.role !== "founder") {
    return apiError("Only founders can create packages", 403);
  }

  const body = await request.json();
  const {
    name, type, description, price, classCredits, validityDays,
    guestPassesPerPeriod = 0, workshopDiscountPercent = 0,
    drinksPerPeriod = 0, bookingWindowHours, priorityBooking = false,
    minCommitmentMonths = 0, priceLockMonths = 0,
    maxQuantity, requiresStudentId = false,
    isFounding = false, isActive = true, isVisible = true,
    sortOrder = 0,
  } = body;

  if (!name || !type || price === undefined || !classCredits || !validityDays) {
    return apiError("Missing required fields: name, type, price, classCredits, validityDays");
  }

  const pkg = await prisma.package.create({
    data: {
      name, type, description: description ?? null,
      price: Number(price), classCredits: Number(classCredits),
      validityDays: Number(validityDays),
      guestPassesPerPeriod: Number(guestPassesPerPeriod),
      workshopDiscountPercent: Number(workshopDiscountPercent),
      drinksPerPeriod: Number(drinksPerPeriod),
      bookingWindowHours: bookingWindowHours ? Number(bookingWindowHours) : null,
      priorityBooking: Boolean(priorityBooking),
      minCommitmentMonths: Number(minCommitmentMonths),
      priceLockMonths: Number(priceLockMonths),
      maxQuantity: maxQuantity ? Number(maxQuantity) : null,
      requiresStudentId: Boolean(requiresStudentId),
      isFounding: Boolean(isFounding),
      isActive: Boolean(isActive),
      isVisible: Boolean(isVisible),
      sortOrder: Number(sortOrder),
    },
  });

  await audit({
    actorId: user.id,
    action: AUDIT_ACTIONS.PACKAGE_CREATED,
    entityType: "package",
    entityId: pkg.id,
    newValue: { name, type, price, classCredits },
  });

  return apiSuccess(pkg, 201);
}

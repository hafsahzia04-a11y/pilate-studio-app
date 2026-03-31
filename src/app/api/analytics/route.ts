// GET /api/analytics  — founder analytics dashboard data

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/lib/utils";
import { startOfMonth, endOfMonth, subMonths, startOfWeek, endOfWeek } from "date-fns";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorised", 401);

  const actor = await prisma.profile.findUnique({ where: { id: user.id } });
  if (actor?.role !== "founder") return apiError("Founders only", 403);

  const { searchParams } = new URL(request.url);
  const range = searchParams.get("range") ?? "month"; // "week" | "month" | "3months"
  const now = new Date();

  let from: Date, to: Date;
  if (range === "week") {
    from = startOfWeek(now);
    to = endOfWeek(now);
  } else if (range === "3months") {
    from = startOfMonth(subMonths(now, 2));
    to = endOfMonth(now);
  } else {
    from = startOfMonth(now);
    to = endOfMonth(now);
  }

  // ── Revenue ────────────────────────────────────────────────────────────────
  const payments = await prisma.payment.groupBy({
    by: ["status"],
    where: { createdAt: { gte: from, lte: to } },
    _sum: { netAmount: true },
    _count: true,
  });

  const totalRevenue = payments
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + Number(p._sum.netAmount ?? 0), 0);

  // ── Membership counts ──────────────────────────────────────────────────────
  const activeMembers = await prisma.clientPackage.count({
    where: { status: "active" },
  });

  const expiringThisWeek = await prisma.clientPackage.count({
    where: {
      status: "active",
      expiryDate: { gte: now, lte: new Date(now.getTime() + 7 * 86400000) },
    },
  });

  const overduePayments = await prisma.clientPackage.count({
    where: {
      paymentStatus: "overdue",
      OR: [
        { paymentStatus: "unpaid", paymentDueDate: { lt: now } },
        { paymentStatus: "partial", paymentDueDate: { lt: now } },
      ],
    },
  });

  // ── Class occupancy ────────────────────────────────────────────────────────
  const sessions = await prisma.classSession.findMany({
    where: { startTime: { gte: from, lte: to }, status: "completed" },
    include: {
      _count: {
        select: {
          bookings: { where: { status: "attended" } },
        },
      },
      category: { select: { name: true } },
    },
  });

  const avgOccupancy =
    sessions.length > 0
      ? sessions.reduce(
          (sum, s) => sum + s._count.bookings / s.capacity,
          0
        ) / sessions.length
      : 0;

  // ── Bookings by status ────────────────────────────────────────────────────
  const bookingStats = await prisma.booking.groupBy({
    by: ["status"],
    where: {
      classSession: { startTime: { gte: from, lte: to } },
    },
    _count: true,
  });

  // ── Package sales ─────────────────────────────────────────────────────────
  const packageSales = await prisma.clientPackage.groupBy({
    by: ["packageId"],
    where: { createdAt: { gte: from, lte: to } },
    _count: true,
  });

  const packageDetails = await prisma.package.findMany({
    where: { id: { in: packageSales.map((p) => p.packageId) } },
    select: { id: true, name: true, price: true },
  });

  const packageSalesEnriched = packageSales.map((p) => {
    const pkg = packageDetails.find((pd) => pd.id === p.packageId);
    return {
      packageId: p.packageId,
      packageName: pkg?.name ?? "Unknown",
      count: p._count,
      revenue: Number(pkg?.price ?? 0) * p._count,
    };
  });

  // ── Most popular classes ──────────────────────────────────────────────────
  const popularClasses = sessions
    .sort((a, b) => b._count.bookings - a._count.bookings)
    .slice(0, 5)
    .map((s) => ({
      title: s.title,
      category: s.category.name,
      attended: s._count.bookings,
      capacity: s.capacity,
      occupancyPct: Math.round((s._count.bookings / s.capacity) * 100),
    }));

  // ── No-show rate ──────────────────────────────────────────────────────────
  const totalBookings = bookingStats.reduce((sum, b) => sum + b._count, 0);
  const noShows =
    bookingStats.find((b) => b.status === "no_show")?._count ?? 0;
  const noShowRate =
    totalBookings > 0 ? Math.round((noShows / totalBookings) * 100) : 0;

  // ── Inventory ─────────────────────────────────────────────────────────────
  const lowStockProducts = await prisma.product.count({
    where: {
      isActive: true,
      stockQuantity: { lte: prisma.product.fields.lowStockThreshold },
    },
  });

  const productRevenue = await prisma.productTransaction.aggregate({
    where: {
      type: "purchased",
      createdAt: { gte: from, lte: to },
    },
    _sum: { totalAmount: true },
  });

  return apiSuccess({
    period: { from, to, range },
    revenue: {
      total: totalRevenue,
      product: Number(productRevenue._sum.totalAmount ?? 0),
    },
    members: {
      active: activeMembers,
      expiringThisWeek,
      overduePayments,
    },
    classes: {
      total: sessions.length,
      avgOccupancyPct: Math.round(avgOccupancy * 100),
      noShowRate,
      popular: popularClasses,
    },
    bookings: bookingStats.reduce(
      (acc, b) => ({ ...acc, [b.status]: b._count }),
      {} as Record<string, number>
    ),
    packageSales: packageSalesEnriched,
    inventory: { lowStockCount: lowStockProducts },
  });
}

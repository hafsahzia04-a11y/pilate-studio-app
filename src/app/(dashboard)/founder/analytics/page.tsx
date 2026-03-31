import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { AnalyticsDashboard } from "./_components/AnalyticsDashboard";
import { startOfMonth, endOfMonth, subMonths, eachWeekOfInterval, startOfWeek, endOfWeek } from "date-fns";

export const metadata = { title: "Analytics" };

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    select: { fullName: true, email: true, role: true },
  });
  if (!profile || profile.role !== "founder") redirect("/login");

  const now = new Date();
  const from = startOfMonth(subMonths(now, 2));
  const to = endOfMonth(now);

  // Revenue by week
  const payments = await prisma.payment.findMany({
    where: { status: "paid", createdAt: { gte: from, lte: to } },
    select: { amount: true, createdAt: true },
  });

  const weeks = eachWeekOfInterval({ start: from, end: to });
  const revenueByWeek = weeks.map((weekStart) => {
    const weekEnd = endOfWeek(weekStart);
    const weekRevenue = payments
      .filter((p) => p.createdAt >= weekStart && p.createdAt <= weekEnd)
      .reduce((sum, p) => sum + Number(p.amount), 0);
    return {
      week: `${weekStart.getDate()}/${weekStart.getMonth() + 1}`,
      revenue: Math.round(weekRevenue),
    };
  });

  // Booking stats
  const bookingStats = await prisma.booking.groupBy({
    by: ["status"],
    where: { classSession: { startTime: { gte: from, lte: to } } },
    _count: true,
  });

  // Package sales
  const packageSales = await prisma.clientPackage.groupBy({
    by: ["packageId"],
    where: { createdAt: { gte: from, lte: to } },
    _count: true,
  });
  const packageDetails = await prisma.package.findMany({
    where: { id: { in: packageSales.map((p) => p.packageId) } },
    select: { id: true, name: true, price: true },
  });
  const salesData = packageSales.map((p) => {
    const pkg = packageDetails.find((pd) => pd.id === p.packageId);
    return {
      name: pkg?.name ?? "Unknown",
      count: p._count,
      revenue: Number(pkg?.price ?? 0) * p._count,
    };
  });

  // Class occupancy (top 5)
  const topClasses = await prisma.classSession.findMany({
    where: { startTime: { gte: from, lte: to }, status: "completed" },
    include: {
      _count: { select: { bookings: { where: { status: "attended" } } } },
    },
    orderBy: { bookings: { _count: "desc" } },
    take: 5,
  });

  const occupancyData = topClasses.map((s) => ({
    name: s.title.length > 16 ? s.title.slice(0, 16) + "…" : s.title,
    booked: s._count.bookings,
    capacity: s.capacity,
    pct: Math.round((s._count.bookings / s.capacity) * 100),
  }));

  // Summary stats
  const totalRevenue = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const activeMembers = await prisma.clientPackage.count({ where: { status: "active" } });
  const totalBookings = bookingStats.reduce((sum, b) => sum + b._count, 0);

  return (
    <DashboardLayout
      role="founder"
      userName={profile.fullName}
      userEmail={profile.email}
      pageTitle="Analytics"
    >
      <AnalyticsDashboard
        revenueByWeek={revenueByWeek}
        bookingStats={bookingStats.map((b) => ({ status: b.status, count: b._count }))}
        packageSales={salesData}
        occupancyData={occupancyData}
        summary={{ totalRevenue, activeMembers, totalBookings }}
      />
    </DashboardLayout>
  );
}

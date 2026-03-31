import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users,
  Calendar,
  DollarSign,
  AlertTriangle,
  Clock,
  Package,
  ArrowRight,
  CheckCircle,
} from "lucide-react";
import { formatCurrency, formatDateTime, formatDate, paymentStatusLabel } from "@/lib/utils";

export const metadata = { title: "Dashboard" };

export default async function FounderDashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    select: { id: true, fullName: true, email: true, role: true },
  });
  if (!profile || profile.role !== "founder") redirect("/login");

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const weekFromNow = new Date(now);
  weekFromNow.setDate(weekFromNow.getDate() + 7);

  // Parallel data fetches
  const [
    activeMembers,
    classesToday,
    revenueThisMonth,
    overdueCount,
    expiringCount,
    lowStockCount,
    recentBookings,
    overduePackages,
    expiringToday,
  ] = await Promise.all([
    // Active members
    prisma.clientPackage.count({
      where: { status: "active" },
    }),
    // Classes today
    prisma.classSession.count({
      where: {
        startTime: { gte: todayStart, lte: todayEnd },
        status: "scheduled",
      },
    }),
    // Revenue this month
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        status: "paid",
        paidAt: { gte: monthStart },
      },
    }),
    // Overdue payments
    prisma.clientPackage.count({
      where: { paymentStatus: "overdue" },
    }),
    // Packages expiring within 7 days
    prisma.clientPackage.count({
      where: {
        status: "active",
        expiryDate: { gte: now, lte: weekFromNow },
      },
    }),
    // Low stock products
    prisma.product.count({
      where: {
        isActive: true,
        stockQuantity: { lte: prisma.product.fields.lowStockThreshold },
      },
    }).catch(() =>
      // Fallback: fetch all and filter
      prisma.product
        .findMany({ where: { isActive: true }, select: { stockQuantity: true, lowStockThreshold: true } })
        .then((ps) => ps.filter((p) => p.stockQuantity <= p.lowStockThreshold).length)
    ),
    // Recent 5 bookings
    prisma.booking.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        client: { select: { fullName: true } },
        classSession: { select: { title: true, startTime: true } },
      },
    }),
    // Overdue packages (up to 3)
    prisma.clientPackage.findMany({
      take: 3,
      where: { paymentStatus: "overdue" },
      include: {
        client: { select: { fullName: true, email: true } },
        package: { select: { name: true } },
      },
      orderBy: { paymentDueDate: "asc" },
    }),
    // Expiring today (up to 3)
    prisma.clientPackage.findMany({
      take: 3,
      where: {
        status: "active",
        expiryDate: { gte: todayStart, lte: todayEnd },
      },
      include: {
        client: { select: { fullName: true } },
        package: { select: { name: true } },
      },
    }),
  ]);

  const totalRevenue =
    (revenueThisMonth._sum.amount as unknown as number | null) ?? 0;

  return (
    <DashboardLayout
      role={profile.role}
      userName={profile.fullName}
      userEmail={profile.email}
      pageTitle="Dashboard"
    >
      {/* Welcome */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-900">
          Good {getGreeting()}, {profile.fullName.split(" ")[0]}
        </h1>
        <p className="text-stone-500 text-sm mt-0.5">
          {formatDate(now, "EEEE, d MMMM yyyy")}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <StatCard
          title="Active Members"
          value={activeMembers}
          icon={<Users className="h-5 w-5" />}
          color="sage"
          subtitle="Current packages"
        />
        <StatCard
          title="Classes Today"
          value={classesToday}
          icon={<Calendar className="h-5 w-5" />}
          color="blue"
          subtitle="Scheduled sessions"
        />
        <StatCard
          title="Revenue This Month"
          value={formatCurrency(Number(totalRevenue))}
          icon={<DollarSign className="h-5 w-5" />}
          color="sage"
          subtitle={formatDate(monthStart, "MMMM yyyy")}
        />
        <StatCard
          title="Overdue Payments"
          value={overdueCount}
          icon={<AlertTriangle className="h-5 w-5" />}
          color={overdueCount > 0 ? "red" : "stone"}
          subtitle="Need attention"
        />
        <StatCard
          title="Expiring This Week"
          value={expiringCount}
          icon={<Clock className="h-5 w-5" />}
          color={expiringCount > 0 ? "amber" : "stone"}
          subtitle="Packages ending soon"
        />
        <StatCard
          title="Low Stock Items"
          value={lowStockCount}
          icon={<Package className="h-5 w-5" />}
          color={lowStockCount > 0 ? "amber" : "stone"}
          subtitle="Products to restock"
        />
      </div>

      {/* Quick Links + Alerts row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {/* Quick Actions */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            <Link href="/founder/schedule" className="block">
              <div className="flex items-center justify-between p-3 rounded-xl hover:bg-cream-100 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-sage-50 text-sage-600">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-medium text-stone-700">View Schedule</span>
                </div>
                <ArrowRight className="h-4 w-4 text-stone-400 group-hover:text-stone-600 transition-colors" />
              </div>
            </Link>
            <Link href="/founder/clients" className="block">
              <div className="flex items-center justify-between p-3 rounded-xl hover:bg-cream-100 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                    <Users className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-medium text-stone-700">Manage Clients</span>
                </div>
                <ArrowRight className="h-4 w-4 text-stone-400 group-hover:text-stone-600 transition-colors" />
              </div>
            </Link>
            <Link href="/founder/analytics" className="block">
              <div className="flex items-center justify-between p-3 rounded-xl hover:bg-cream-100 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
                    <DollarSign className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-medium text-stone-700">Run Reports</span>
                </div>
                <ArrowRight className="h-4 w-4 text-stone-400 group-hover:text-stone-600 transition-colors" />
              </div>
            </Link>
          </CardContent>
        </Card>

        {/* Alerts */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Alerts</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-4">
            {/* Overdue payments */}
            {overduePackages.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-2">
                  Overdue Payments ({overdueCount})
                </p>
                <div className="space-y-1.5">
                  {overduePackages.map((cp) => (
                    <div
                      key={cp.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-red-50 border border-red-100"
                    >
                      <div>
                        <p className="text-sm font-medium text-stone-800">
                          {cp.client.fullName}
                        </p>
                        <p className="text-xs text-stone-500">{cp.package.name}</p>
                      </div>
                      <Badge variant="danger">Overdue</Badge>
                    </div>
                  ))}
                </div>
                {overdueCount > 3 && (
                  <Link href="/founder/payments?tab=overdue">
                    <p className="text-xs text-sage-600 mt-2 hover:underline">
                      View all {overdueCount} overdue →
                    </p>
                  </Link>
                )}
              </div>
            )}

            {/* Expiring today */}
            {expiringToday.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-2">
                  Expiring Today ({expiringToday.length})
                </p>
                <div className="space-y-1.5">
                  {expiringToday.map((cp) => (
                    <div
                      key={cp.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-amber-50 border border-amber-100"
                    >
                      <div>
                        <p className="text-sm font-medium text-stone-800">
                          {cp.client.fullName}
                        </p>
                        <p className="text-xs text-stone-500">{cp.package.name}</p>
                      </div>
                      <Badge variant="warning">Expires today</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {overduePackages.length === 0 && expiringToday.length === 0 && (
              <div className="flex flex-col items-center py-6 text-center">
                <CheckCircle className="h-8 w-8 text-sage-400 mb-2" />
                <p className="text-sm text-stone-500">All clear — no urgent alerts.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Bookings</CardTitle>
            <Link href="/founder/schedule">
              <Button variant="ghost" size="sm" className="text-sage-600">
                View all
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {recentBookings.length === 0 ? (
            <p className="text-sm text-stone-400 py-4 text-center">No bookings yet.</p>
          ) : (
            <div className="divide-y divide-stone-100">
              {recentBookings.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between py-3 gap-4"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-stone-800 truncate">
                      {b.client.fullName}
                    </p>
                    <p className="text-xs text-stone-500 truncate">
                      {b.classSession.title}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-stone-500">
                      {formatDateTime(b.classSession.startTime)}
                    </p>
                    <Badge
                      variant={
                        b.status === "confirmed"
                          ? "sage"
                          : b.status === "attended"
                          ? "success"
                          : b.status === "cancelled"
                          ? "default"
                          : "warning"
                      }
                      className="mt-0.5"
                    >
                      {b.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

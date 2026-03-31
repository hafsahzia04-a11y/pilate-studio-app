import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatDate, formatTime, formatCurrency, daysUntil, paymentStatusColor, paymentStatusLabel } from "@/lib/utils";
import Link from "next/link";
import { Calendar, ArrowRight, AlertTriangle } from "lucide-react";

export const metadata = { title: "Home" };

export default async function ClientHomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const profile = await prisma.profile.findUnique({ where: { id: user.id }, select: { fullName: true, email: true, role: true } });
  if (!profile) redirect("/login");

  const activePackage = await prisma.clientPackage.findFirst({
    where: { clientId: user.id, status: { in: ["active", "paused"] } },
    include: { package: true },
    orderBy: { createdAt: "desc" },
  });

  const upcomingBookings = await prisma.booking.findMany({
    where: { clientId: user.id, status: "confirmed", classSession: { startTime: { gte: new Date() } } },
    include: {
      classSession: {
        select: { title: true, startTime: true, endTime: true, room: true, category: { select: { name: true, color: true } }, instructor: { select: { fullName: true } } },
      },
    },
    orderBy: { classSession: { startTime: "asc" } },
    take: 3,
  });

  const firstName = profile.fullName.split(" ")[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const expiryDays = activePackage ? daysUntil(activePackage.expiryDate) : null;
  const creditPct = activePackage ? (activePackage.remainingCredits / activePackage.totalCredits) * 100 : 0;

  return (
    <DashboardLayout role="client" userName={profile.fullName} userEmail={profile.email} pageTitle="Home">
      <div className="space-y-5">
        {/* Greeting */}
        <div>
          <h1 className="text-2xl font-bold text-stone-900">{greeting}, {firstName} 👋</h1>
          <p className="text-stone-500 text-sm mt-0.5">{formatDate(new Date(), "EEEE, d MMMM")}</p>
        </div>

        {/* Expiry warning */}
        {expiryDays !== null && expiryDays <= 7 && expiryDays > 0 && (
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
            <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
            <p className="text-sm text-amber-700">Your membership expires in <strong>{expiryDays} day{expiryDays !== 1 ? "s" : ""}</strong>. Contact the studio to renew.</p>
          </div>
        )}
        {expiryDays !== null && expiryDays <= 0 && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
            <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700">Your membership has expired. Please contact the studio to renew.</p>
          </div>
        )}

        {/* Package card */}
        {activePackage ? (
          <Card className="p-5">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">Active Plan</p>
                <p className="text-lg font-bold text-stone-900 mt-0.5">{activePackage.package.name}</p>
              </div>
              <Badge variant={activePackage.paymentStatus === "paid" ? "sage" : activePackage.paymentStatus === "overdue" ? "danger" : "warning"}>
                {paymentStatusLabel(activePackage.paymentStatus)}
              </Badge>
            </div>

            {/* Credits */}
            <div className="mb-4">
              <div className="flex justify-between text-xs text-stone-500 mb-1.5">
                <span>Class credits</span>
                <span className="font-medium text-stone-700">{activePackage.remainingCredits} of {activePackage.totalCredits} remaining</span>
              </div>
              <div className="h-3 bg-stone-100 rounded-full overflow-hidden">
                <div className={cn("h-full rounded-full transition-all", creditPct > 50 ? "bg-sage-400" : creditPct > 25 ? "bg-amber-400" : "bg-red-400")}
                  style={{ width: `${Math.max(creditPct, 2)}%` }} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              {activePackage.guestPassesRemaining > 0 && (
                <div className="bg-stone-50 rounded-xl p-2">
                  <p className="text-lg font-bold text-stone-900">{activePackage.guestPassesRemaining}</p>
                  <p className="text-xs text-stone-500">Guest passes</p>
                </div>
              )}
              {activePackage.drinksRemaining > 0 && (
                <div className="bg-stone-50 rounded-xl p-2">
                  <p className="text-lg font-bold text-stone-900">{activePackage.drinksRemaining}</p>
                  <p className="text-xs text-stone-500">Wellness shots</p>
                </div>
              )}
              <div className="bg-stone-50 rounded-xl p-2">
                <p className="text-lg font-bold text-stone-900">{expiryDays !== null && expiryDays > 0 ? expiryDays : 0}</p>
                <p className="text-xs text-stone-500">Days left</p>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="p-5 border-dashed border-2 border-stone-200 bg-stone-50">
            <p className="text-stone-500 text-sm text-center mb-3">You don't have an active plan</p>
            <p className="text-xs text-center text-stone-400">Contact the studio to purchase a membership or class pack</p>
          </Card>
        )}

        {/* Book button */}
        <Link href="/client/book">
          <Button size="xl" className="w-full bg-sage-500 hover:bg-sage-600 text-white rounded-2xl">
            <Calendar className="h-5 w-5" />
            Book a Class
          </Button>
        </Link>

        {/* Upcoming bookings */}
        {upcomingBookings.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-stone-700">Upcoming</h2>
              <Link href="/client/bookings" className="text-xs text-sage-600 font-medium flex items-center gap-1">View all <ArrowRight className="h-3 w-3" /></Link>
            </div>
            <div className="space-y-2">
              {upcomingBookings.map(b => (
                <Card key={b.id} className="p-4">
                  <div className="flex gap-3 items-center">
                    <div className="w-1.5 h-10 rounded-full flex-shrink-0" style={{ backgroundColor: b.classSession.category.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-stone-900 truncate">{b.classSession.title}</p>
                      <p className="text-xs text-stone-500">{formatDate(b.classSession.startTime, "EEE d MMM")} · {formatTime(b.classSession.startTime)}</p>
                    </div>
                    <Badge variant="sage" className="text-xs">Confirmed</Badge>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

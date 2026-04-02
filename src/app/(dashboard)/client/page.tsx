import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatDate, formatTime, formatCurrency, daysUntil, paymentStatusLabel } from "@/lib/utils";
import Link from "next/link";
import { Calendar, ArrowRight, AlertTriangle, CheckCircle, Clock, User, Lock } from "lucide-react";

export const metadata = { title: "Home" };

export default async function ClientHomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const profile = await prisma.profile.findUnique({ where: { id: user.id }, select: { fullName: true, email: true, role: true } });
  if (!profile) redirect("/login");

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999);

  const [activePackages, availablePackages, todaySessions, upcomingBookings] = await Promise.all([
    prisma.clientPackage.findMany({
      where: { clientId: user.id, status: { in: ["active", "paused", "pending_payment"] } },
      include: { package: { select: { name: true, type: true, priorityBooking: true, isFounding: true } } },
      orderBy: { createdAt: "desc" },
    }),

    prisma.package.findMany({
      where: { isActive: true, isVisible: true },
      select: {
        id: true, name: true, type: true, description: true,
        price: true, classCredits: true, validityDays: true,
        drinksPerPeriod: true, priorityBooking: true, isFounding: true,
      },
      orderBy: [{ sortOrder: "asc" }, { price: "asc" }],
    }),

    prisma.classSession.findMany({
      where: { startTime: { gte: todayStart, lte: todayEnd }, status: "scheduled" },
      include: {
        category: { select: { name: true, color: true } },
        instructor: { select: { fullName: true } },
      },
      orderBy: { startTime: "asc" },
      take: 8,
    }),

    prisma.booking.findMany({
      where: { clientId: user.id, status: "confirmed", classSession: { startTime: { gte: new Date() } } },
      include: {
        classSession: {
          select: { title: true, startTime: true, endTime: true, room: true,
            category: { select: { name: true, color: true } }, instructor: { select: { fullName: true } } },
        },
      },
      orderBy: { classSession: { startTime: "asc" } },
      take: 3,
    }),
  ]);

  const activePaidPackage = activePackages.find(p => p.status === "active" && p.paymentStatus === "paid");
  const pendingPackage    = activePackages.find(p => p.paymentStatus !== "paid");
  const isPaid = !!activePaidPackage;

  const firstName = profile.fullName.split(" ")[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const expiryDays = activePaidPackage ? daysUntil(activePaidPackage.expiryDate) : null;
  const creditPct  = activePaidPackage ? (activePaidPackage.remainingCredits / activePaidPackage.totalCredits) * 100 : 0;

  function validityLabel(days: number) {
    if (days === 1) return "1 day";
    if (days <= 7) return `${days} days`;
    if (days <= 31) return `${Math.round(days / 7)} week${Math.round(days / 7) !== 1 ? "s" : ""}`;
    return `${Math.round(days / 30)} month${Math.round(days / 30) !== 1 ? "s" : ""}`;
  }

  return (
    <DashboardLayout role="client" userName={profile.fullName} userEmail={profile.email} pageTitle="Home">
      <div className="space-y-5">
        {/* Greeting */}
        <div>
          <h1 className="text-2xl font-bold text-stone-900">{greeting}, {firstName} 👋</h1>
          <p className="text-stone-500 text-sm mt-0.5">{formatDate(new Date(), "EEEE, d MMMM")}</p>
        </div>

        {/* Payment status banners */}
        {pendingPackage && !isPaid && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
            <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Payment pending — {pendingPackage.package.name}</p>
              <p className="text-xs text-amber-700 mt-0.5">Once the receptionist confirms your payment, booking will be unlocked.</p>
            </div>
          </div>
        )}
        {!pendingPackage && !isPaid && activePackages.length === 0 && (
          <div className="flex items-start gap-3 bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3">
            <Lock className="h-4 w-4 text-stone-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-stone-600">Select a package below and pay at reception to unlock class booking.</p>
          </div>
        )}
        {expiryDays !== null && expiryDays <= 7 && expiryDays > 0 && (
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
            <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
            <p className="text-sm text-amber-700">Your membership expires in <strong>{expiryDays} day{expiryDays !== 1 ? "s" : ""}</strong>. Contact reception to renew.</p>
          </div>
        )}

        {/* Active membership card */}
        {activePaidPackage && (
          <Card className="p-5">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">Active Plan</p>
                <p className="text-lg font-bold text-stone-900 mt-0.5">{activePaidPackage.package.name}</p>
                {(activePaidPackage.package.priorityBooking || activePaidPackage.package.isFounding) && (
                  <p className="text-xs text-sage-600 font-medium mt-0.5">Priority Member — can change bookings up to 48h before</p>
                )}
              </div>
              <Badge variant="sage"><CheckCircle className="h-3 w-3 mr-1" />Active</Badge>
            </div>
            <div className="mb-4">
              <div className="flex justify-between text-xs text-stone-500 mb-1.5">
                <span>Class credits</span>
                <span className="font-medium text-stone-700">{activePaidPackage.remainingCredits} of {activePaidPackage.totalCredits} remaining</span>
              </div>
              <div className="h-3 bg-stone-100 rounded-full overflow-hidden">
                <div className={cn("h-full rounded-full transition-all", creditPct > 50 ? "bg-sage-400" : creditPct > 25 ? "bg-amber-400" : "bg-red-400")}
                  style={{ width: `${Math.max(creditPct, 2)}%` }} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              {activePaidPackage.guestPassesRemaining > 0 && (
                <div className="bg-stone-50 rounded-xl p-2">
                  <p className="text-lg font-bold text-stone-900">{activePaidPackage.guestPassesRemaining}</p>
                  <p className="text-xs text-stone-500">Guest passes</p>
                </div>
              )}
              {activePaidPackage.drinksRemaining > 0 && (
                <div className="bg-stone-50 rounded-xl p-2">
                  <p className="text-lg font-bold text-stone-900">{activePaidPackage.drinksRemaining}</p>
                  <p className="text-xs text-stone-500">Wellness shots</p>
                </div>
              )}
              <div className="bg-stone-50 rounded-xl p-2">
                <p className="text-lg font-bold text-stone-900">{expiryDays !== null && expiryDays > 0 ? expiryDays : 0}</p>
                <p className="text-xs text-stone-500">Days left</p>
              </div>
            </div>
          </Card>
        )}

        {/* Today's schedule — always visible */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-stone-700">Today&apos;s Classes</h2>
            {isPaid && (
              <Link href="/client/book" className="text-xs text-sage-600 font-medium flex items-center gap-1">
                All dates <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>

          {todaySessions.length === 0 ? (
            <Card className="p-6 text-center text-stone-400">
              <Clock className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No classes scheduled today</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {todaySessions.map(s => {
                const booked = upcomingBookings.some(b => new Date(b.classSession.startTime).getTime() === s.startTime.getTime());
                return (
                  <Card key={s.id} className="p-4">
                    <div className="flex gap-3 items-center">
                      <div className="w-1.5 self-stretch rounded-full flex-shrink-0 min-h-[40px]" style={{ backgroundColor: s.category.color }} />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-stone-900">{s.title}</p>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-stone-500 mt-0.5">
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatTime(s.startTime)}</span>
                          <span className="flex items-center gap-1"><User className="h-3 w-3" />{s.instructor.fullName}</span>
                        </div>
                      </div>
                      {booked
                        ? <Badge variant="sage">Booked</Badge>
                        : isPaid
                          ? <Link href="/client/book"><Button size="sm" variant="outline" className="flex-shrink-0">Book</Button></Link>
                          : <Lock className="h-4 w-4 text-stone-300 flex-shrink-0" />
                      }
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Book button (only if paid) */}
        {isPaid ? (
          <Link href="/client/book">
            <Button size="xl" className="w-full bg-sage-500 hover:bg-sage-600 text-white rounded-2xl">
              <Calendar className="h-5 w-5" />
              Browse All Classes & Book
            </Button>
          </Link>
        ) : (
          <div className="rounded-2xl border-2 border-dashed border-stone-200 p-4 text-center">
            <Lock className="h-6 w-6 text-stone-300 mx-auto mb-2" />
            <p className="text-sm font-medium text-stone-500">Booking locked until payment is confirmed</p>
            <p className="text-xs text-stone-400 mt-1">Visit reception or contact us to complete payment</p>
          </div>
        )}

        {/* Packages catalog — shown when no active paid package */}
        {!isPaid && (
          <div>
            <h2 className="text-sm font-semibold text-stone-700 mb-3">Choose Your Plan</h2>
            <div className="space-y-3">
              {availablePackages.map(pkg => (
                <Card key={pkg.id} className={cn("p-4", pkg.isFounding && "border-sage-300 bg-sage-50", pkg.priorityBooking && !pkg.isFounding && "border-amber-200")}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-stone-900">{pkg.name}</p>
                        {pkg.isFounding && <Badge variant="sage">Founding</Badge>}
                        {pkg.priorityBooking && <Badge variant="warning">Priority</Badge>}
                      </div>
                      {pkg.description && <p className="text-xs text-stone-500 mt-0.5">{pkg.description}</p>}
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-xs text-stone-600">
                        <span>{pkg.classCredits} class credit{pkg.classCredits !== 1 ? "s" : ""}</span>
                        <span>Valid {validityLabel(pkg.validityDays)}</span>
                        {pkg.drinksPerPeriod > 0 && <span>{pkg.drinksPerPeriod} wellness shot{pkg.drinksPerPeriod !== 1 ? "s" : ""}/month</span>}
                        {pkg.priorityBooking && <span className="text-sage-600 font-medium">Change bookings up to 48h</span>}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xl font-bold text-stone-900">{formatCurrency(Number(pkg.price))}</p>
                      {pkg.validityDays >= 28 && <p className="text-xs text-stone-400">/month</p>}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
            <p className="text-xs text-stone-400 text-center mt-3">Present this screen at reception to purchase your plan</p>
          </div>
        )}

        {/* Upcoming bookings */}
        {upcomingBookings.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-stone-700">Your Upcoming Classes</h2>
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
                    <Badge variant="sage">Confirmed</Badge>
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

import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, formatDate, formatCurrency, paymentStatusLabel, paymentStatusColor, daysUntil } from "@/lib/utils";

export const metadata = { title: "My Plan" };

export default async function ClientProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    include: {
      clientProfile: true,
      clientPackages: {
        include: { package: true, payments: { orderBy: { createdAt: "desc" }, take: 5 } },
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
  });
  if (!profile) redirect("/login");

  const active = profile.clientPackages.find(cp => cp.status === "active");
  const creditPct = active ? (active.remainingCredits / active.totalCredits) * 100 : 0;

  return (
    <DashboardLayout role="client" userName={profile.fullName} userEmail={profile.email} pageTitle="My Plan">
      <div className="space-y-5">

        {/* Active package */}
        {active ? (
          <Card className="p-5">
            <div className="flex items-start justify-between gap-2 mb-4">
              <div>
                <p className="text-xs text-stone-500 uppercase tracking-wide">Current Plan</p>
                <p className="text-xl font-bold text-stone-900 mt-0.5">{active.package.name}</p>
              </div>
              <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", paymentStatusColor(active.paymentStatus))}>
                {paymentStatusLabel(active.paymentStatus)}
              </span>
            </div>

            <div className="mb-4">
              <div className="flex justify-between text-xs text-stone-500 mb-1.5">
                <span>Class credits</span>
                <span className="font-semibold text-stone-700">{active.remainingCredits} / {active.totalCredits}</span>
              </div>
              <div className="h-3 bg-stone-100 rounded-full overflow-hidden">
                <div className={cn("h-full rounded-full", creditPct > 50 ? "bg-sage-400" : creditPct > 25 ? "bg-amber-400" : "bg-red-400")} style={{ width: `${Math.max(creditPct, 2)}%` }} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-stone-50 rounded-xl p-3">
                <p className="text-xs text-stone-500">Expires</p>
                <p className="font-semibold text-stone-800 mt-0.5">{formatDate(active.expiryDate)}</p>
                <p className="text-xs text-stone-400">{daysUntil(active.expiryDate)} days left</p>
              </div>
              <div className="bg-stone-50 rounded-xl p-3">
                <p className="text-xs text-stone-500">Started</p>
                <p className="font-semibold text-stone-800 mt-0.5">{formatDate(active.startDate)}</p>
              </div>
              {active.guestPassesRemaining > 0 && (
                <div className="bg-stone-50 rounded-xl p-3">
                  <p className="text-xs text-stone-500">Guest passes</p>
                  <p className="font-semibold text-stone-800 mt-0.5">{active.guestPassesRemaining} remaining</p>
                </div>
              )}
              {active.drinksRemaining > 0 && (
                <div className="bg-stone-50 rounded-xl p-3">
                  <p className="text-xs text-stone-500">Wellness shots</p>
                  <p className="font-semibold text-stone-800 mt-0.5">{active.drinksRemaining} remaining</p>
                </div>
              )}
            </div>

            {active.package.workshopDiscountPercent > 0 && (
              <div className="mt-3 flex items-center gap-2 bg-sage-50 rounded-xl px-3 py-2">
                <span className="text-sage-600 text-sm">✨</span>
                <p className="text-xs text-sage-700 font-medium">{active.package.workshopDiscountPercent}% discount on workshops</p>
              </div>
            )}
          </Card>
        ) : (
          <Card className="p-5 text-center border-dashed border-2 border-stone-200">
            <p className="text-stone-500">No active plan</p>
            <p className="text-xs text-stone-400 mt-1">Contact the studio to get started</p>
          </Card>
        )}

        {/* Referral code */}
        {profile.clientProfile?.referralCode && (
          <Card className="p-4">
            <p className="text-xs text-stone-500 mb-1">Your referral code</p>
            <div className="flex items-center justify-between">
              <p className="text-xl font-bold text-stone-900 tracking-widest">{profile.clientProfile.referralCode}</p>
              <button onClick={() => { navigator.clipboard.writeText(profile.clientProfile!.referralCode!); }}
                className="text-xs text-sage-600 font-medium hover:underline">Copy</button>
            </div>
            <p className="text-xs text-stone-400 mt-1">Share this with friends who join the studio</p>
          </Card>
        )}

        {/* Personal details */}
        <Card>
          <CardHeader><CardTitle>Personal Details</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs text-stone-500">Full name</p>
              <p className="text-sm font-medium text-stone-800 mt-0.5">{profile.fullName}</p>
            </div>
            <div>
              <p className="text-xs text-stone-500">Email</p>
              <p className="text-sm font-medium text-stone-800 mt-0.5">{profile.email}</p>
            </div>
            {profile.phone && (
              <div>
                <p className="text-xs text-stone-500">Phone (WhatsApp)</p>
                <p className="text-sm font-medium text-stone-800 mt-0.5">{profile.phone}</p>
              </div>
            )}
            {profile.clientProfile?.emergencyContactName && (
              <div>
                <p className="text-xs text-stone-500">Emergency contact</p>
                <p className="text-sm font-medium text-stone-800 mt-0.5">{profile.clientProfile.emergencyContactName} · {profile.clientProfile.emergencyContactPhone}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-stone-500">Waiver signed</p>
              <p className="text-sm font-medium text-stone-800 mt-0.5">{profile.clientProfile?.waiverSignedAt ? formatDate(profile.clientProfile.waiverSignedAt) : <span className="text-amber-600">Not yet signed — contact the studio</span>}</p>
            </div>
          </CardContent>
        </Card>

        {/* Package history */}
        {profile.clientPackages.length > 1 && (
          <Card>
            <CardHeader><CardTitle>Plan History</CardTitle></CardHeader>
            <CardContent className="p-0">
              {profile.clientPackages.slice(1).map(cp => (
                <div key={cp.id} className="flex items-center justify-between px-5 py-3 border-b border-stone-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-stone-700">{cp.package.name}</p>
                    <p className="text-xs text-stone-400">{formatDate(cp.startDate)} – {formatDate(cp.expiryDate)}</p>
                  </div>
                  <Badge variant={cp.status === "expired" ? "default" : "sage"} className="capitalize">{cp.status}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

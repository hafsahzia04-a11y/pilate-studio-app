import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Lock, ArrowLeft } from "lucide-react";
import { BookingUI } from "./_components/BookingUI";

export const metadata = { title: "Book a Class" };

export default async function BookPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    select: { fullName: true, email: true, role: true },
  });
  if (!profile) redirect("/login");

  // Check for an active, fully paid package — required to book
  const activePaidPackage = await prisma.clientPackage.findFirst({
    where: { clientId: user.id, status: "active", paymentStatus: "paid" },
    select: { id: true },
  });

  const canBook = !!activePaidPackage;

  return (
    <DashboardLayout role="client" userName={profile.fullName} userEmail={profile.email} pageTitle="Book a Class">
      {canBook ? (
        <BookingUI />
      ) : (
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-4 px-4">
          <div className="h-16 w-16 rounded-2xl bg-stone-100 flex items-center justify-center">
            <Lock className="h-7 w-7 text-stone-400" />
          </div>
          <div>
            <p className="text-lg font-semibold text-stone-900">Booking not yet available</p>
            <p className="text-sm text-stone-500 mt-1 max-w-xs">
              Your package payment hasn&apos;t been confirmed yet. Once the receptionist records your payment, you&apos;ll be able to book classes.
            </p>
          </div>
          <Card className="w-full max-w-xs p-4 bg-amber-50 border-amber-200 text-left">
            <p className="text-xs font-semibold text-amber-800 mb-1">What to do:</p>
            <ol className="text-xs text-amber-700 space-y-1 list-decimal list-inside">
              <li>Choose a package on the home screen</li>
              <li>Visit reception and make payment</li>
              <li>Receptionist confirms — booking unlocks automatically</li>
            </ol>
          </Card>
          <Link href="/client">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4" /> Back to home
            </Button>
          </Link>
        </div>
      )}
    </DashboardLayout>
  );
}

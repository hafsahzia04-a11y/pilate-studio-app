import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PackagesManager } from "./_components/PackagesManager";
import type { PackageWithStats } from "@/types";

export const metadata = { title: "Packages" };

export default async function PackagesPage() {
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

  // Fetch packages with active purchase count
  const rawPackages = await prisma.package.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      _count: {
        select: {
          clientPackages: {
            where: { status: "active" },
          },
        },
      },
    },
  });

  const packages: PackageWithStats[] = rawPackages.map((p) => ({
    id: p.id,
    name: p.name,
    type: p.type,
    price: Number(p.price),
    classCredits: p.classCredits,
    validityDays: p.validityDays,
    guestPassesPerPeriod: p.guestPassesPerPeriod,
    workshopDiscountPercent: p.workshopDiscountPercent,
    drinksPerPeriod: p.drinksPerPeriod,
    bookingWindowHours: p.bookingWindowHours,
    priorityBooking: p.priorityBooking,
    minCommitmentMonths: p.minCommitmentMonths,
    priceLockMonths: p.priceLockMonths,
    maxQuantity: p.maxQuantity,
    soldCount: p.soldCount,
    requiresStudentId: p.requiresStudentId,
    isFounding: p.isFounding,
    isActive: p.isActive,
    isVisible: p.isVisible,
    description: p.description,
    activePurchases: p._count.clientPackages,
  }));

  return (
    <DashboardLayout
      role={profile.role}
      userName={profile.fullName}
      userEmail={profile.email}
      pageTitle="Packages"
    >
      <PackagesManager packages={packages} />
    </DashboardLayout>
  );
}

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PaymentsManager } from "./_components/PaymentsManager";

export const metadata = { title: "Payments" };

export default async function PaymentsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    select: { id: true, fullName: true, email: true, role: true },
  });
  if (!profile || profile.role !== "founder") redirect("/login");

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const weekFromNow = new Date(now);
  weekFromNow.setDate(weekFromNow.getDate() + 7);
  const thirtyDaysFromNow = new Date(now);
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  const [
    payments,
    overduePackages,
    expiringPackages,
    dueSoonPackages,
    allClients,
    dropInPackage,
    monthlySummary,
    overdueBalance,
  ] = await Promise.all([
    // Recent payments
    prisma.payment.findMany({
      take: 50,
      orderBy: { createdAt: "desc" },
      include: {
        client: { select: { fullName: true, email: true } },
        clientPackage: {
          select: {
            package: { select: { name: true } },
            paymentStatus: true,
            amountDue: true,
            amountPaid: true,
          },
        },
      },
    }),

    // Overdue client packages
    prisma.clientPackage.findMany({
      where: { paymentStatus: "overdue" },
      orderBy: { paymentDueDate: "asc" },
      include: {
        client: { select: { id: true, fullName: true, email: true, phone: true } },
        package: { select: { name: true } },
      },
    }),

    // Expiring within 7 days
    prisma.clientPackage.findMany({
      where: { status: "active", expiryDate: { gte: now, lte: weekFromNow } },
      orderBy: { expiryDate: "asc" },
      include: {
        client: { select: { id: true, fullName: true, email: true } },
        package: { select: { name: true } },
      },
    }),

    // Payment due within 30 days (not yet overdue)
    prisma.clientPackage.findMany({
      where: {
        paymentStatus: { in: ["unpaid", "partial"] },
        paymentDueDate: { gte: now, lte: thirtyDaysFromNow },
      },
      orderBy: { paymentDueDate: "asc" },
      include: {
        client: { select: { id: true, fullName: true, email: true, phone: true } },
        package: { select: { name: true } },
      },
    }),

    // All active clients with their active packages for the Record Payment form
    prisma.profile.findMany({
      where: { role: "client", status: "active" },
      select: {
        id: true,
        fullName: true,
        email: true,
        clientPackages: {
          where: { status: { in: ["active", "pending_payment"] } },
          select: {
            id: true,
            amountDue: true,
            amountPaid: true,
            paymentStatus: true,
            expiryDate: true,
            package: { select: { name: true, type: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { fullName: "asc" },
    }),

    // Drop-in package definition for price reference
    prisma.package.findFirst({
      where: { type: "drop_in", isActive: true },
      select: { id: true, name: true, price: true, classCredits: true, validityDays: true },
    }),

    // Total collected this month
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: { status: "paid", paidAt: { gte: monthStart } },
    }),

    // Outstanding overdue total
    prisma.clientPackage.aggregate({
      _sum: { amountDue: true },
      where: { paymentStatus: "overdue" },
    }),
  ]);

  return (
    <DashboardLayout
      role={profile.role}
      userName={profile.fullName}
      userEmail={profile.email}
      pageTitle="Payments"
    >
      <PaymentsManager
        payments={payments.map((p) => ({
          id: p.id,
          clientName: p.client.fullName,
          clientEmail: p.client.email,
          packageName: p.clientPackage?.package.name ?? "—",
          amount: Number(p.amount),
          netAmount: Number(p.netAmount),
          status: p.status,
          paymentMethod: p.paymentMethod,
          dueDate: p.dueDate?.toISOString() ?? null,
          paidAt: p.paidAt?.toISOString() ?? null,
          createdAt: p.createdAt.toISOString(),
          referenceNumber: p.referenceNumber,
          notes: p.notes,
        }))}
        overduePackages={overduePackages.map((cp) => ({
          id: cp.id,
          clientId: cp.client.id,
          clientName: cp.client.fullName,
          clientEmail: cp.client.email,
          clientPhone: cp.client.phone,
          packageName: cp.package.name,
          amountDue: Number(cp.amountDue),
          amountPaid: Number(cp.amountPaid),
          outstanding: Number(cp.amountDue) - Number(cp.amountPaid),
          dueDate: cp.paymentDueDate?.toISOString() ?? null,
        }))}
        expiringPackages={expiringPackages.map((cp) => ({
          id: cp.id,
          clientName: cp.client.fullName,
          clientEmail: cp.client.email,
          packageName: cp.package.name,
          expiryDate: cp.expiryDate.toISOString(),
          remainingCredits: cp.remainingCredits,
        }))}
        dueSoonPackages={dueSoonPackages.map((cp) => ({
          id: cp.id,
          clientId: cp.client.id,
          clientName: cp.client.fullName,
          clientEmail: cp.client.email,
          clientPhone: cp.client.phone,
          packageName: cp.package.name,
          amountDue: Number(cp.amountDue),
          amountPaid: Number(cp.amountPaid),
          outstanding: Number(cp.amountDue) - Number(cp.amountPaid),
          dueDate: cp.paymentDueDate?.toISOString() ?? null,
        }))}
        allClients={allClients.map((c) => ({
          id: c.id,
          fullName: c.fullName,
          email: c.email,
          packages: c.clientPackages.map((cp) => ({
            id: cp.id,
            packageName: cp.package.name,
            packageType: cp.package.type,
            amountDue: Number(cp.amountDue),
            amountPaid: Number(cp.amountPaid),
            outstanding: Number(cp.amountDue) - Number(cp.amountPaid),
            paymentStatus: cp.paymentStatus,
            expiryDate: cp.expiryDate.toISOString(),
          })),
        }))}
        dropInPrice={dropInPackage ? Number(dropInPackage.price) : 75}
        totalCollected={Number(monthlySummary._sum.amount ?? 0)}
        totalOutstanding={Number(overdueBalance._sum.amountDue ?? 0)}
        overdueCount={overduePackages.length}
        dueSoonCount={dueSoonPackages.length}
      />
    </DashboardLayout>
  );
}

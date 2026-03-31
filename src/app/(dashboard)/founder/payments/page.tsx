import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PaymentsManager } from "./_components/PaymentsManager";

export const metadata = { title: "Payments" };

export default async function PaymentsPage() {
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
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const weekFromNow = new Date(now);
  weekFromNow.setDate(weekFromNow.getDate() + 7);

  const [payments, overduePackages, expiringPackages, monthlySummary, overdueBalance] =
    await Promise.all([
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
      // Expiring soon
      prisma.clientPackage.findMany({
        where: {
          status: "active",
          expiryDate: { gte: now, lte: weekFromNow },
        },
        orderBy: { expiryDate: "asc" },
        include: {
          client: { select: { id: true, fullName: true, email: true } },
          package: { select: { name: true } },
        },
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

  const totalCollected = Number(monthlySummary._sum.amount ?? 0);
  const totalOutstanding = Number(overdueBalance._sum.amountDue ?? 0);

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
        totalCollected={totalCollected}
        totalOutstanding={totalOutstanding}
        overdueCount={overduePackages.length}
      />
    </DashboardLayout>
  );
}

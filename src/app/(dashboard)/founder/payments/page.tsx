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

  // Tomorrow window
  const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
  const tomorrowEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 23, 59, 59);

  const [payments, overduePackages, expiringPackages, dueTomorrowPackages, allClients, dropInPackage, monthlySummary, overdueBalance] =
    await Promise.all([
      prisma.payment.findMany({
        take: 50,
        orderBy: { createdAt: "desc" },
        include: {
          client: { select: { fullName: true, email: true } },
          clientPackage: {
            select: {
              package: { select: { name: true } },
              paymentStatus: true, amountDue: true, amountPaid: true,
            },
          },
        },
      }),

      // Overdue — stay red until paid
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

      // Due TOMORROW only
      prisma.clientPackage.findMany({
        where: {
          paymentStatus: { in: ["unpaid", "partial"] },
          paymentDueDate: { gte: tomorrowStart, lte: tomorrowEnd },
        },
        orderBy: { paymentDueDate: "asc" },
        include: {
          client: { select: { id: true, fullName: true, email: true, phone: true } },
          package: { select: { name: true } },
        },
      }),

      // All active clients with their packages for the Record Payment form
      prisma.profile.findMany({
        where: { role: "client", status: "active" },
        select: {
          id: true, fullName: true, email: true,
          clientPackages: {
            where: { status: { in: ["active", "pending_payment"] } },
            select: {
              id: true, amountDue: true, amountPaid: true,
              paymentStatus: true, expiryDate: true,
              package: { select: { name: true, type: true } },
            },
            orderBy: { createdAt: "desc" },
          },
        },
        orderBy: { fullName: "asc" },
      }),

      prisma.package.findFirst({
        where: { type: "drop_in", isActive: true },
        select: { id: true, name: true, price: true, classCredits: true, validityDays: true },
      }),

      prisma.payment.aggregate({
        _sum: { amount: true },
        where: { status: "paid", paidAt: { gte: monthStart } },
      }),

      prisma.clientPackage.aggregate({
        _sum: { amountDue: true },
        where: { paymentStatus: "overdue" },
      }),
    ]);

  return (
    <DashboardLayout role={profile.role} userName={profile.fullName} userEmail={profile.email} pageTitle="Payments">
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
          id: cp.id, clientId: cp.client.id,
          clientName: cp.client.fullName, clientEmail: cp.client.email,
          clientPhone: cp.client.phone, packageName: cp.package.name,
          amountDue: Number(cp.amountDue), amountPaid: Number(cp.amountPaid),
          outstanding: Number(cp.amountDue) - Number(cp.amountPaid),
          dueDate: cp.paymentDueDate?.toISOString() ?? null,
        }))}
        expiringPackages={expiringPackages.map((cp) => ({
          id: cp.id, clientName: cp.client.fullName,
          clientEmail: cp.client.email, packageName: cp.package.name,
          expiryDate: cp.expiryDate.toISOString(), remainingCredits: cp.remainingCredits,
        }))}
        dueTomorrowPackages={dueTomorrowPackages.map((cp) => ({
          id: cp.id, clientId: cp.client.id,
          clientName: cp.client.fullName, clientEmail: cp.client.email,
          clientPhone: cp.client.phone, packageName: cp.package.name,
          amountDue: Number(cp.amountDue), amountPaid: Number(cp.amountPaid),
          outstanding: Number(cp.amountDue) - Number(cp.amountPaid),
          dueDate: cp.paymentDueDate?.toISOString() ?? null,
        }))}
        allClients={allClients.map((c) => ({
          id: c.id, fullName: c.fullName, email: c.email,
          packages: c.clientPackages.map((cp) => ({
            id: cp.id, packageName: cp.package.name, packageType: cp.package.type,
            amountDue: Number(cp.amountDue), amountPaid: Number(cp.amountPaid),
            outstanding: Number(cp.amountDue) - Number(cp.amountPaid),
            paymentStatus: cp.paymentStatus, expiryDate: cp.expiryDate.toISOString(),
          })),
        }))}
        dropInPrice={dropInPackage ? Number(dropInPackage.price) : 75}
        totalCollected={Number(monthlySummary._sum.amount ?? 0)}
        totalOutstanding={Number(overdueBalance._sum.amountDue ?? 0)}
        overdueCount={overduePackages.length}
        dueTomorrowCount={dueTomorrowPackages.length}
      />
    </DashboardLayout>
  );
}

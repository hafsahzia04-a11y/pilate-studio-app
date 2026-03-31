import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ClientsTable } from "../../founder/clients/_components/ClientsTable";

export const metadata = { title: "Clients" };

export default async function StaffClientsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const profile = await prisma.profile.findUnique({ where: { id: user.id }, select: { fullName: true, email: true, role: true } });
  if (!profile || !["founder", "staff"].includes(profile.role)) redirect("/login");

  const clients = await prisma.profile.findMany({
    where: { role: "client" },
    include: {
      clientProfile: { select: { tags: true, staffNotes: true, waiverSignedAt: true } },
      clientPackages: {
        where: { status: { in: ["active", "paused"] } },
        include: { package: { select: { name: true, type: true } } },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { fullName: "asc" },
  });

  const serialized = clients.map(c => ({
    ...c,
    activePackage: c.clientPackages[0]
      ? { ...c.clientPackages[0], amountDue: Number(c.clientPackages[0].amountDue), amountPaid: Number(c.clientPackages[0].amountPaid), expiryDate: c.clientPackages[0].expiryDate.toISOString(), startDate: c.clientPackages[0].startDate.toISOString() }
      : null,
    clientPackages: undefined,
  }));

  return (
    <DashboardLayout role={profile.role as "staff"} userName={profile.fullName} userEmail={profile.email} pageTitle="Clients">
      <ClientsTable clients={serialized as Parameters<typeof ClientsTable>[0]["clients"]} isStaff={true} />
    </DashboardLayout>
  );
}

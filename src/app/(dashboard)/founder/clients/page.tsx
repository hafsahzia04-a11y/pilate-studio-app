"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ClientsTable } from "./_components/ClientsTable";
import type { ClientWithPackage } from "@/types";

export const metadata = { title: "Clients" };

export default async function FounderClientsPage() {
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

  const clients = await prisma.profile.findMany({
    where: { role: "client" },
    orderBy: { fullName: "asc" },
    include: {
      clientProfile: {
        select: {
          tags: true,
          staffNotes: true,
          waiverSignedAt: true,
        },
      },
      clientPackages: {
        where: { status: "active" },
        take: 1,
        orderBy: { createdAt: "desc" },
        include: {
          package: { select: { name: true, type: true } },
        },
      },
    },
  });

  // Shape into ClientWithPackage
  const shaped: ClientWithPackage[] = clients.map((c) => {
    const active = c.clientPackages[0] ?? null;
    return {
      id: c.id,
      fullName: c.fullName,
      email: c.email,
      phone: c.phone,
      status: c.status,
      clientProfile: c.clientProfile
        ? {
            tags: c.clientProfile.tags,
            staffNotes: c.clientProfile.staffNotes,
            waiverSignedAt: c.clientProfile.waiverSignedAt,
          }
        : null,
      activePackage: active
        ? {
            id: active.id,
            package: { name: active.package.name, type: active.package.type },
            remainingCredits: active.remainingCredits,
            totalCredits: active.totalCredits,
            expiryDate: active.expiryDate,
            paymentStatus: active.paymentStatus,
            status: active.status,
            guestPassesRemaining: active.guestPassesRemaining,
            drinksRemaining: active.drinksRemaining,
          }
        : null,
    };
  });

  return (
    <DashboardLayout
      role={profile.role}
      userName={profile.fullName}
      userEmail={profile.email}
      pageTitle="Clients"
    >
      <ClientsTable clients={shaped} />
    </DashboardLayout>
  );
}

// /founder/clients/[id]/edit — Edit client profile (server page)

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ClientEditForm } from "./_components/ClientEditForm";

interface Props {
  params: { id: string };
}

export default async function ClientEditPage({ params }: Props) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const actor = await prisma.profile.findUnique({ where: { id: user.id } });
  if (!["founder", "staff"].includes(actor?.role ?? "")) redirect("/");

  const profile = await prisma.profile.findUnique({
    where: { id: params.id },
    include: { clientProfile: true },
  });

  if (!profile || profile.role !== "client") notFound();

  const client = {
    id: profile.id,
    fullName: profile.fullName,
    email: profile.email,
    phone: profile.phone ?? null,
    status: profile.status,
    emergencyContactName: profile.clientProfile?.emergencyContactName ?? null,
    emergencyContactPhone: profile.clientProfile?.emergencyContactPhone ?? null,
    injuryNotes: profile.clientProfile?.injuryNotes ?? null,
    medicalNotes: profile.clientProfile?.medicalNotes ?? null,
    staffNotes: profile.clientProfile?.staffNotes ?? null,
    tags: profile.clientProfile?.tags ?? [],
  };

  return (
    <DashboardLayout
      role={actor!.role}
      userName={actor!.fullName}
      userEmail={actor!.email}
      pageTitle="Edit Client"
    >
      <ClientEditForm client={client} />
    </DashboardLayout>
  );
}

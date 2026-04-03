// /founder/clients/[id] — Full client profile (server page)

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { ClientProfile } from "./_components/ClientProfile";

interface Props {
  params: { id: string };
}

export default async function ClientProfilePage({ params }: Props) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const actor = await prisma.profile.findUnique({ where: { id: user.id } });
  if (!["founder", "staff"].includes(actor?.role ?? "")) redirect("/");

  const profile = await prisma.profile.findUnique({
    where: { id: params.id },
    include: {
      clientProfile: true,
      clientPackages: {
        include: {
          package: true,
          payments: { orderBy: { createdAt: "desc" } },
        },
        orderBy: { createdAt: "desc" },
      },
      bookings: {
        include: {
          classSession: {
            select: {
              id: true,
              title: true,
              startTime: true,
              endTime: true,
              room: true,
              category: { select: { name: true, color: true } },
              instructor: { select: { fullName: true } },
            },
          },
          clientPackage: {
            select: { package: { select: { name: true } }, remainingCredits: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
    },
  });

  if (!profile || profile.role !== "client") notFound();

  // Serialise Decimals and Dates for client component
  const serialised = {
    ...profile,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
    clientProfile: profile.clientProfile
      ? {
          ...profile.clientProfile,
          dateOfBirth: profile.clientProfile.dateOfBirth?.toISOString() ?? null,
          waiverSignedAt: profile.clientProfile.waiverSignedAt?.toISOString() ?? null,
          createdAt: profile.clientProfile.createdAt.toISOString(),
          updatedAt: profile.clientProfile.updatedAt.toISOString(),
        }
      : null,
    clientPackages: profile.clientPackages.map((cp) => ({
      ...cp,
      price: Number(cp.amountDue),
      amountPaid: Number(cp.amountPaid),
      amountDue: Number(cp.amountDue),
      lockedPrice: cp.lockedPrice ? Number(cp.lockedPrice) : null,
      startDate: cp.startDate.toISOString(),
      expiryDate: cp.expiryDate.toISOString(),
      renewalDate: cp.renewalDate?.toISOString() ?? null,
      paymentDueDate: cp.paymentDueDate?.toISOString() ?? null,
      lastPerkResetDate: cp.lastPerkResetDate?.toISOString() ?? null,
      createdAt: cp.createdAt.toISOString(),
      updatedAt: cp.updatedAt.toISOString(),
      package: {
        ...cp.package,
        price: Number(cp.package.price),
      },
      payments: cp.payments.map((p) => ({
        ...p,
        amount: Number(p.amount),
        netAmount: Number(p.netAmount),
        discountApplied: Number(p.discountApplied),
        paidAt: p.paidAt?.toISOString() ?? null,
        dueDate: p.dueDate?.toISOString() ?? null,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      })),
    })),
    bookings: profile.bookings.map((b) => ({
      ...b,
      createdAt: b.createdAt.toISOString(),
      updatedAt: b.updatedAt.toISOString(),
      classSession: {
        ...b.classSession,
        startTime: b.classSession.startTime.toISOString(),
        endTime: b.classSession.endTime.toISOString(),
      },
    })),
  };

  return <ClientProfile client={serialised as never} />;
}

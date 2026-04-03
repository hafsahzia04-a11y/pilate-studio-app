// /founder/clients/new — Multi-step client registration wizard (server page)

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { addDays } from "date-fns";
import { RegistrationWizard } from "./_components/RegistrationWizard";

export default async function RegisterClientPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const actor = await prisma.profile.findUnique({ where: { id: user.id } });
  if (!["founder", "staff"].includes(actor?.role ?? "")) redirect("/");

  // Fetch active packages for Step 2
  const packages = await prisma.package.findMany({
    where: { isActive: true, isVisible: true },
    orderBy: [{ sortOrder: "asc" }, { price: "asc" }],
  });

  // Fetch upcoming class sessions (next 14 days) for Step 3
  const now = new Date();
  const twoWeeksOut = addDays(now, 14);

  const sessions = await prisma.classSession.findMany({
    where: {
      startTime: { gte: now, lte: twoWeeksOut },
      status: "scheduled",
    },
    include: {
      category: { select: { name: true, color: true } },
      instructor: { select: { id: true, fullName: true } },
      _count: {
        select: {
          bookings: { where: { status: { in: ["confirmed", "attended"] } } },
        },
      },
    },
    orderBy: { startTime: "asc" },
  });

  const enrichedSessions = sessions.map((s) => ({
    id: s.id,
    title: s.title,
    category: s.category,
    instructor: s.instructor,
    room: s.room,
    startTime: s.startTime,
    endTime: s.endTime,
    durationMins: s.durationMins,
    capacity: s.capacity,
    isWorkshop: s.isWorkshop,
    workshopPrice: s.workshopPrice ? Number(s.workshopPrice) : null,
    usesCredits: s.usesCredits,
    status: s.status,
    bookedCount: s._count.bookings,
    spotsLeft: Math.max(0, s.capacity - s._count.bookings),
    isFull: s._count.bookings >= s.capacity,
  }));

  const serialisedPackages = packages.map((p) => ({
    ...p,
    price: Number(p.price),
  }));

  return (
    <div className="max-w-4xl mx-auto py-2">
      <RegistrationWizard
        packages={serialisedPackages}
        sessions={enrichedSessions}
      />
    </div>
  );
}

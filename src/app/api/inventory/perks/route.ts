// GET /api/inventory/perks
// Returns clients who have active packages with drinksRemaining > 0
// Used by the "Redeem Perk" modal on the inventory page

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/lib/utils";

export async function GET(_request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorised", 401);

  const actor = await prisma.profile.findUnique({ where: { id: user.id } });
  if (!actor || !["founder", "staff"].includes(actor.role)) {
    return apiError("Forbidden", 403);
  }

  const rows = await prisma.clientPackage.findMany({
    where: {
      status: "active",
      drinksRemaining: { gt: 0 },
    },
    include: {
      client: { select: { id: true, fullName: true, email: true } },
      package: { select: { name: true, drinksPerPeriod: true } },
    },
    orderBy: [{ client: { fullName: "asc" } }],
  });

  return apiSuccess(
    rows.map((cp) => ({
      clientPackageId: cp.id,
      clientId: cp.clientId,
      clientName: cp.client.fullName,
      clientEmail: cp.client.email,
      packageName: cp.package.name,
      drinksRemaining: cp.drinksRemaining,
      drinksPerPeriod: cp.package.drinksPerPeriod,
    }))
  );
}

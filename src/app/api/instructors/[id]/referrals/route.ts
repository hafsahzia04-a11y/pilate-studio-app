// GET   /api/instructors/[id]/referrals  — list referrals for an instructor
// POST  /api/instructors/[id]/referrals  — add a referral
// PATCH /api/instructors/[id]/referrals  — toggle referral active status

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { audit, AUDIT_ACTIONS } from "@/lib/audit";
import { apiError, apiSuccess } from "@/lib/utils";

// ─── GET /api/instructors/[id]/referrals ──────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorised", 401);

  const actor = await prisma.profile.findUnique({ where: { id: user.id } });
  if (actor?.role !== "founder") return apiError("Forbidden", 403);

  const referrals = await prisma.instructorReferral.findMany({
    where: { instructorId: params.id },
    include: {
      client: { select: { id: true, fullName: true, email: true, status: true } },
    },
    orderBy: { referralDate: "desc" },
  });

  return apiSuccess(referrals);
}

// ─── POST /api/instructors/[id]/referrals ─────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorised", 401);

  const actor = await prisma.profile.findUnique({ where: { id: user.id } });
  if (actor?.role !== "founder") return apiError("Forbidden", 403);

  const body = await request.json();
  const { clientId, referralDate, notes } = body;

  if (!clientId) return apiError("clientId is required");

  // Verify client exists
  const client = await prisma.profile.findUnique({ where: { id: clientId, role: "client" } });
  if (!client) return apiError("Client not found", 404);

  const referral = await prisma.instructorReferral.create({
    data: {
      instructorId: params.id,
      clientId,
      referralDate: referralDate ? new Date(referralDate) : new Date(),
      isActive: true,
      notes: notes ?? null,
    },
    include: {
      client: { select: { id: true, fullName: true, email: true } },
    },
  });

  await audit({
    actorId: user.id,
    action: AUDIT_ACTIONS.REFERRAL_ADDED,
    entityType: "instructor_referral",
    entityId: referral.id,
    newValue: { instructorId: params.id, clientId },
  });

  return apiSuccess(referral, 201);
}

// ─── PATCH /api/instructors/[id]/referrals ────────────────────────────────────
// Toggle isActive for commission eligibility

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorised", 401);

  const actor = await prisma.profile.findUnique({ where: { id: user.id } });
  if (actor?.role !== "founder") return apiError("Forbidden", 403);

  const body = await request.json();
  const { referralId, isActive } = body;

  if (!referralId || isActive === undefined) {
    return apiError("referralId and isActive are required");
  }

  const referral = await prisma.instructorReferral.findUnique({ where: { id: referralId } });
  if (!referral || referral.instructorId !== params.id) {
    return apiError("Referral not found", 404);
  }

  const updated = await prisma.instructorReferral.update({
    where: { id: referralId },
    data: { isActive },
    include: {
      client: { select: { id: true, fullName: true, email: true } },
    },
  });

  await audit({
    actorId: user.id,
    action: AUDIT_ACTIONS.REFERRAL_STATUS_UPDATED,
    entityType: "instructor_referral",
    entityId: referralId,
    newValue: { isActive },
  });

  return apiSuccess(updated);
}

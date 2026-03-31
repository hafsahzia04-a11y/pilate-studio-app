// GET   /api/clients/[id]  — full client profile
// PATCH /api/clients/[id]  — update client

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { audit, AUDIT_ACTIONS } from "@/lib/audit";
import { apiError, apiSuccess } from "@/lib/utils";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorised", 401);

  const actor = await prisma.profile.findUnique({ where: { id: user.id } });
  const isStaff = ["founder", "staff"].includes(actor?.role ?? "");
  const isSelf = user.id === params.id;

  if (!isStaff && !isSelf) return apiError("Forbidden", 403);

  const profile = await prisma.profile.findUnique({
    where: { id: params.id },
    include: {
      clientProfile: true,
      clientPackages: {
        include: {
          package: true,
          payments: { orderBy: { createdAt: "desc" } },
          membershipFreezes: { orderBy: { createdAt: "desc" }, take: 5 },
        },
        orderBy: { createdAt: "desc" },
      },
      bookings: {
        include: {
          classSession: {
            select: {
              title: true,
              startTime: true,
              category: { select: { name: true, color: true } },
              instructor: { select: { fullName: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 30,
      },
      productTransactions: {
        include: { product: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });

  if (!profile) return apiError("Client not found", 404);
  return apiSuccess(profile);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorised", 401);

  const actor = await prisma.profile.findUnique({ where: { id: user.id } });
  const isStaff = ["founder", "staff"].includes(actor?.role ?? "");
  const isSelf = user.id === params.id;

  if (!isStaff && !isSelf) return apiError("Forbidden", 403);

  const body = await request.json();
  const old = await prisma.profile.findUnique({ where: { id: params.id } });

  // Fields clients can change themselves
  const clientFields: Record<string, unknown> = {};
  if (body.phone !== undefined) clientFields.phone = body.phone;

  // Fields only staff can change
  const staffFields: Record<string, unknown> = {};
  if (isStaff) {
    if (body.fullName !== undefined) staffFields.fullName = body.fullName;
    if (body.status !== undefined) staffFields.status = body.status;
  }

  const updated = await prisma.profile.update({
    where: { id: params.id },
    data: { ...clientFields, ...staffFields },
  });

  // Update client profile sub-fields
  const profileUpdates: Record<string, unknown> = {};
  if (body.emergencyContactName !== undefined)
    profileUpdates.emergencyContactName = body.emergencyContactName;
  if (body.emergencyContactPhone !== undefined)
    profileUpdates.emergencyContactPhone = body.emergencyContactPhone;
  if (body.medicalNotes !== undefined && isStaff)
    profileUpdates.medicalNotes = body.medicalNotes;
  if (body.injuryNotes !== undefined)
    profileUpdates.injuryNotes = body.injuryNotes;
  if (body.staffNotes !== undefined && isStaff)
    profileUpdates.staffNotes = body.staffNotes;
  if (body.tags !== undefined && isStaff)
    profileUpdates.tags = body.tags;
  if (body.waiverSignedAt !== undefined && isStaff)
    profileUpdates.waiverSignedAt = new Date(body.waiverSignedAt);

  if (Object.keys(profileUpdates).length > 0) {
    await prisma.clientProfile.upsert({
      where: { id: params.id },
      update: profileUpdates,
      create: { id: params.id, ...profileUpdates },
    });
  }

  await audit({
    actorId: user.id,
    action: AUDIT_ACTIONS.CLIENT_UPDATED,
    entityType: "profile",
    entityId: params.id,
    oldValue: old as Record<string, unknown>,
    newValue: { ...clientFields, ...staffFields, ...profileUpdates },
  });

  return apiSuccess(updated);
}

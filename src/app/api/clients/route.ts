// GET  /api/clients  — list all clients (staff/founder)
// POST /api/clients  — create a new client account

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";
import { audit, AUDIT_ACTIONS } from "@/lib/audit";
import { apiError, apiSuccess } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorised", 401);

  const actor = await prisma.profile.findUnique({ where: { id: user.id } });
  if (!["founder", "staff"].includes(actor?.role ?? "")) {
    return apiError("Forbidden", 403);
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search");
  const status = searchParams.get("status");
  const tag = searchParams.get("tag");
  const packageStatus = searchParams.get("packageStatus");

  const clients = await prisma.profile.findMany({
    where: {
      role: "client",
      ...(status && { status: status as never }),
      ...(search && {
        OR: [
          { fullName: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { phone: { contains: search } },
        ],
      }),
      ...(tag && {
        clientProfile: {
          tags: { has: tag },
        },
      }),
    },
    include: {
      clientProfile: {
        select: { tags: true, staffNotes: true, waiverSignedAt: true },
      },
      clientPackages: {
        where: {
          status: { in: ["active", "paused"] },
          ...(packageStatus && { paymentStatus: packageStatus as never }),
        },
        include: {
          package: { select: { name: true, type: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { fullName: "asc" },
  });

  const enriched = clients.map((c) => ({
    ...c,
    activePackage: c.clientPackages[0] ?? null,
    clientPackages: undefined,
  }));

  return apiSuccess(enriched);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorised", 401);

  const actor = await prisma.profile.findUnique({ where: { id: user.id } });
  if (!["founder", "staff"].includes(actor?.role ?? "")) {
    return apiError("Only founders and staff can create clients", 403);
  }

  const body = await request.json();
  const {
    email, fullName, phone,
    dateOfBirth, emergencyContactName, emergencyContactPhone,
    medicalNotes, tags = [], staffNotes,
    temporaryPassword,
  } = body;

  if (!email || !fullName) return apiError("email and fullName are required");

  // Create auth user via admin client
  const adminSupabase = createAdminClient();
  const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
    email,
    password: temporaryPassword ?? generateTempPassword(),
    email_confirm: true,
    user_metadata: { full_name: fullName, role: "client" },
  });

  if (authError || !authData.user) {
    if (authError?.message.includes("already registered")) {
      return apiError("A user with this email already exists");
    }
    return apiError(authError?.message ?? "Failed to create user");
  }

  // Create profile
  const profile = await prisma.profile.create({
    data: {
      id: authData.user.id,
      email,
      fullName,
      phone: phone ?? null,
      role: "client",
      status: "active",
      clientProfile: {
        create: {
          dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
          emergencyContactName: emergencyContactName ?? null,
          emergencyContactPhone: emergencyContactPhone ?? null,
          medicalNotes: medicalNotes ?? null,
          tags: tags,
          staffNotes: staffNotes ?? null,
          referralCode: generateReferralCode(fullName),
        },
      },
    },
    include: { clientProfile: true },
  });

  await audit({
    actorId: user.id,
    action: AUDIT_ACTIONS.CLIENT_CREATED,
    entityType: "profile",
    entityId: profile.id,
    newValue: { email, fullName, createdByStaff: true },
  });

  return apiSuccess(profile, 201);
}

function generateTempPassword(): string {
  return Math.random().toString(36).slice(-10) + "A1!";
}

function generateReferralCode(name: string): string {
  const base = name.split(" ")[0].toUpperCase().slice(0, 4);
  const rand = Math.random().toString(36).slice(-4).toUpperCase();
  return `${base}${rand}`;
}

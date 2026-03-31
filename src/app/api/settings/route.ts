// GET  /api/settings  — get all studio settings
// POST /api/settings  — update settings (founder only)

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getAllSettings, saveSetting } from "@/lib/settings";
import { audit, AUDIT_ACTIONS } from "@/lib/audit";
import { apiError, apiSuccess } from "@/lib/utils";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorised", 401);

  const actor = await prisma.profile.findUnique({ where: { id: user.id } });
  if (actor?.role !== "founder") return apiError("Founders only", 403);

  const settings = await getAllSettings();
  return apiSuccess(settings);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorised", 401);

  const actor = await prisma.profile.findUnique({ where: { id: user.id } });
  if (actor?.role !== "founder") return apiError("Founders only", 403);

  const body = await request.json();
  const { settings } = body; // { key: value, key2: value2, ... }

  if (!settings || typeof settings !== "object") {
    return apiError("settings object is required");
  }

  const oldSettings = await getAllSettings();
  const changed: string[] = [];

  for (const [key, value] of Object.entries(settings)) {
    await saveSetting(key, value, user.id);
    changed.push(key);
  }

  await audit({
    actorId: user.id,
    action: AUDIT_ACTIONS.SETTING_CHANGED,
    entityType: "studio_setting",
    entityId: "bulk",
    oldValue: Object.fromEntries(
      changed.map((k) => [k, (oldSettings as Record<string, unknown>)[k]])
    ),
    newValue: settings as Record<string, unknown>,
  });

  return apiSuccess({ updated: changed });
}

// ─────────────────────────────────────────────────────────────────────────────
// Studio Settings  — typed helpers to read/write the studio_settings table.
// All business rules that should be configurable by founders live here.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from "@/lib/prisma";

// ─── Default values (used if not yet set in DB) ───────────────────────────────

export const SETTING_DEFAULTS = {
  max_class_capacity: 12,
  max_workshop_capacity: 12,
  default_class_duration_mins: 60,
  default_buffer_time_mins: 30,
  late_cancel_cutoff_hours: 12,        // Cancel within 12h of class = late cancel
  no_show_loses_credit: true,          // If client no-shows, they lose the credit
  late_cancel_loses_credit: true,      // Late cancel also loses credit
  credit_deduct_on: "booking",         // "booking" | "attendance"
  waitlist_auto_promote: true,         // Automatically promote when spot opens
  waitlist_promotion_window_hours: 2,  // Client has 2h to confirm after promotion
  standard_booking_window_hours: 168,  // Clients can book up to 7 days ahead
  whatsapp_enabled: true,
  notify_on_booking: true,
  notify_on_cancellation: true,
  notify_expiry_days: [7, 3, 1],       // Days before expiry to send reminder
  notify_overdue_days: [1, 7],         // Days after due date to send reminder
  studio_timezone: "Asia/Dubai",
  currency: "AED",
  tax_percent: 0,
  studio_phone: "",
  studio_email: "",
  studio_address: "",
  founding_member_limit: 50,           // Max founding member spots
} as const;

export type SettingKey = keyof typeof SETTING_DEFAULTS;
export type SettingValue<K extends SettingKey> = (typeof SETTING_DEFAULTS)[K];

// ─── Get a single setting (typed) ─────────────────────────────────────────────

export async function getSetting<K extends SettingKey>(
  key: K
): Promise<SettingValue<K>> {
  const row = await prisma.studioSetting.findUnique({ where: { key } });
  if (!row) return SETTING_DEFAULTS[key];
  return row.value as SettingValue<K>;
}

// ─── Get multiple settings at once ────────────────────────────────────────────

export async function getSettings<K extends SettingKey>(
  keys: K[]
): Promise<{ [key in K]: SettingValue<key> }> {
  const rows = await prisma.studioSetting.findMany({
    where: { key: { in: keys } },
  });

  const result = {} as { [key in K]: SettingValue<key> };
  for (const key of keys) {
    const row = rows.find((r) => r.key === key);
    result[key] = row ? (row.value as SettingValue<key>) : SETTING_DEFAULTS[key];
  }
  return result;
}

// ─── Get ALL settings for the settings page ───────────────────────────────────

export async function getAllSettings(): Promise<
  Record<SettingKey, unknown>
> {
  const rows = await prisma.studioSetting.findMany();
  const result = { ...SETTING_DEFAULTS } as Record<string, unknown>;
  for (const row of rows) {
    result[row.key] = row.value;
  }
  return result as Record<SettingKey, unknown>;
}

// ─── Save a setting ───────────────────────────────────────────────────────────

export async function saveSetting(
  key: string,
  value: unknown,
  updatedById?: string
): Promise<void> {
  await prisma.studioSetting.upsert({
    where: { key },
    update: { value: value as never, updatedById: updatedById ?? null },
    create: { key, value: value as never, updatedById: updatedById ?? null },
  });
}

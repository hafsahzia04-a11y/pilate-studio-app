"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

interface Props { initialSettings: Record<string, unknown> }

export function SettingsForm({ initialSettings }: Props) {
  const [settings, setSettings] = useState<Record<string, unknown>>(initialSettings);
  const [saving, setSaving] = useState(false);
  const [testingWA, setTestingWA] = useState(false);

  const set = (key: string, value: unknown) => setSettings(prev => ({ ...prev, [key]: value }));

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ settings }) });
      if (res.ok) toast.success("Settings saved!");
      else { const { error } = await res.json(); toast.error(error ?? "Failed to save"); }
    } finally { setSaving(false); }
  }

  async function testWhatsApp() {
    setTestingWA(true);
    try {
      const res = await fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "test" }) });
      const data = await res.json();
      if (data.success) toast.success("✅ WhatsApp test message sent! Check your phone.");
      else toast.error("Failed: " + (data.message ?? "Check your API key"));
    } finally { setTestingWA(false); }
  }

  const Toggle = ({ k }: { k: string }) => (
    <button onClick={() => set(k, !settings[k])}
      className={cn("w-11 h-6 rounded-full transition-colors relative flex-shrink-0", settings[k] ? "bg-sage-500" : "bg-stone-200")}>
      <span className={cn("absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform", settings[k] ? "translate-x-5" : "translate-x-0")} />
    </button>
  );

  const Row = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-stone-50 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-stone-700">{label}</p>
        {hint && <p className="text-xs text-stone-400 mt-0.5">{hint}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Class Rules */}
      <Card>
        <CardHeader><CardTitle>Class Rules</CardTitle></CardHeader>
        <CardContent>
          <Row label="Max class capacity" hint="Max participants per class or workshop">
            <input type="number" value={String(settings.max_class_capacity ?? 12)} onChange={e => set("max_class_capacity", Number(e.target.value))}
              className="w-20 h-9 border border-stone-200 rounded-xl px-3 text-sm text-center focus:outline-none focus:border-sage-400" />
          </Row>
          <Row label="Default class duration (mins)">
            <input type="number" value={String(settings.default_class_duration_mins ?? 60)} onChange={e => set("default_class_duration_mins", Number(e.target.value))}
              className="w-20 h-9 border border-stone-200 rounded-xl px-3 text-sm text-center focus:outline-none focus:border-sage-400" />
          </Row>
          <Row label="Buffer time between classes (mins)">
            <input type="number" value={String(settings.default_buffer_time_mins ?? 30)} onChange={e => set("default_buffer_time_mins", Number(e.target.value))}
              className="w-20 h-9 border border-stone-200 rounded-xl px-3 text-sm text-center focus:outline-none focus:border-sage-400" />
          </Row>
          <Row label="Late cancel cutoff (hours before class)" hint="Cancellations within this window lose a credit">
            <input type="number" value={String(settings.late_cancel_cutoff_hours ?? 12)} onChange={e => set("late_cancel_cutoff_hours", Number(e.target.value))}
              className="w-20 h-9 border border-stone-200 rounded-xl px-3 text-sm text-center focus:outline-none focus:border-sage-400" />
          </Row>
          <Row label="Late cancellation loses credit">
            <Toggle k="late_cancel_loses_credit" />
          </Row>
          <Row label="No-show loses credit">
            <Toggle k="no_show_loses_credit" />
          </Row>
          <Row label="Deduct credit on" hint="When the credit is taken from the member's balance">
            <select value={String(settings.credit_deduct_on ?? "booking")} onChange={e => set("credit_deduct_on", e.target.value)}
              className="h-9 border border-stone-200 rounded-xl px-3 text-sm focus:outline-none focus:border-sage-400">
              <option value="booking">Booking</option>
              <option value="attendance">Attendance</option>
            </select>
          </Row>
        </CardContent>
      </Card>

      {/* Booking Rules */}
      <Card>
        <CardHeader><CardTitle>Booking Rules</CardTitle></CardHeader>
        <CardContent>
          <Row label="Standard booking window (hours)" hint="How far ahead standard members can book">
            <input type="number" value={String(settings.standard_booking_window_hours ?? 168)} onChange={e => set("standard_booking_window_hours", Number(e.target.value))}
              className="w-24 h-9 border border-stone-200 rounded-xl px-3 text-sm text-center focus:outline-none focus:border-sage-400" />
          </Row>
          <Row label="Auto-promote from waitlist">
            <Toggle k="waitlist_auto_promote" />
          </Row>
          <Row label="Waitlist promotion window (hours)" hint="How long a promoted member has to confirm">
            <input type="number" value={String(settings.waitlist_promotion_window_hours ?? 2)} onChange={e => set("waitlist_promotion_window_hours", Number(e.target.value))}
              className="w-20 h-9 border border-stone-200 rounded-xl px-3 text-sm text-center focus:outline-none focus:border-sage-400" />
          </Row>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader><CardTitle>WhatsApp Notifications</CardTitle></CardHeader>
        <CardContent>
          <Row label="WhatsApp enabled">
            <Toggle k="whatsapp_enabled" />
          </Row>
          <Row label="Notify on booking confirmation">
            <Toggle k="notify_on_booking" />
          </Row>
          <Row label="Notify on booking cancellation">
            <Toggle k="notify_on_cancellation" />
          </Row>
          <Row label="Test WhatsApp connection" hint="Sends a test message to the founder's number">
            <Button size="sm" variant="outline" onClick={testWhatsApp} loading={testingWA}>
              Send Test
            </Button>
          </Row>
        </CardContent>
      </Card>

      {/* Studio */}
      <Card>
        <CardHeader><CardTitle>Studio Info</CardTitle></CardHeader>
        <CardContent>
          <Row label="Timezone">
            <input value={String(settings.studio_timezone ?? "Asia/Dubai")} onChange={e => set("studio_timezone", e.target.value)}
              className="w-44 h-9 border border-stone-200 rounded-xl px-3 text-sm focus:outline-none focus:border-sage-400" />
          </Row>
          <Row label="Currency">
            <input value={String(settings.currency ?? "AED")} onChange={e => set("currency", e.target.value)}
              className="w-20 h-9 border border-stone-200 rounded-xl px-3 text-sm text-center focus:outline-none focus:border-sage-400" />
          </Row>
          <Row label="Tax %">
            <input type="number" value={String(settings.tax_percent ?? 0)} onChange={e => set("tax_percent", Number(e.target.value))}
              className="w-20 h-9 border border-stone-200 rounded-xl px-3 text-sm text-center focus:outline-none focus:border-sage-400" />
          </Row>
        </CardContent>
      </Card>

      <Button onClick={save} loading={saving} size="lg" className="w-full">Save All Settings</Button>
    </div>
  );
}

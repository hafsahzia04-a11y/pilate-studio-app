import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { getAllSettings } from "@/lib/settings";
import { SettingsForm } from "./_components/SettingsForm";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const profile = await prisma.profile.findUnique({ where: { id: user.id }, select: { fullName: true, email: true, role: true } });
  if (profile?.role !== "founder") redirect("/login");

  const settings = await getAllSettings();

  return (
    <DashboardLayout role="founder" userName={profile.fullName} userEmail={profile.email} pageTitle="Settings">
      <SettingsForm initialSettings={settings as Record<string, unknown>} />
    </DashboardLayout>
  );
}

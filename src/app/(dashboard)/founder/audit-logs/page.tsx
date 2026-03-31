import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateTime, truncate } from "@/lib/utils";

export const metadata = { title: "Audit Log" };

export default async function AuditLogsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const profile = await prisma.profile.findUnique({ where: { id: user.id }, select: { fullName: true, email: true, role: true } });
  if (profile?.role !== "founder") redirect("/login");

  const logs = await prisma.auditLog.findMany({
    include: { actor: { select: { fullName: true, role: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const actionColor = (action: string) => {
    if (action.includes("cancel") || action.includes("delete")) return "text-red-600 bg-red-50";
    if (action.includes("created") || action.includes("purchased")) return "text-sage-700 bg-sage-50";
    if (action.includes("updated") || action.includes("changed")) return "text-amber-700 bg-amber-50";
    return "text-stone-600 bg-stone-100";
  };

  return (
    <DashboardLayout role="founder" userName={profile.fullName} userEmail={profile.email} pageTitle="Audit Log">
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100">
                  {["Time","Actor","Action","Entity","Details"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-stone-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id} className="border-b border-stone-50 hover:bg-cream-50">
                    <td className="px-4 py-3 text-xs text-stone-500 whitespace-nowrap">{formatDateTime(log.createdAt)}</td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-medium text-stone-700">{log.actor?.fullName ?? "System"}</p>
                      <p className="text-xs text-stone-400 capitalize">{log.actor?.role ?? "—"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${actionColor(log.action)}`}>{log.action}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-stone-600 whitespace-nowrap">{log.entityType} <span className="text-stone-400">#{log.entityId.slice(-6)}</span></td>
                    <td className="px-4 py-3 text-xs text-stone-500 max-w-xs">
                      {log.newValue ? truncate(JSON.stringify(log.newValue), 60) : "—"}
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-10 text-stone-400">No audit records yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}

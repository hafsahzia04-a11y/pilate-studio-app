import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dumbbell, Users, Clock } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Classes" };

export default async function ClassesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    select: { fullName: true, email: true, role: true },
  });
  if (!profile || profile.role !== "founder") redirect("/login");

  const [templates, categories, instructors] = await Promise.all([
    prisma.classTemplate.findMany({
      include: { category: true, _count: { select: { sessions: true } } },
      orderBy: { title: "asc" },
    }),
    prisma.classCategory.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    prisma.profile.findMany({
      where: { role: "instructor", status: "active" },
      select: { id: true, fullName: true },
    }),
  ]);

  return (
    <DashboardLayout
      role="founder"
      userName={profile.fullName}
      userEmail={profile.email}
      pageTitle="Class Templates"
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-stone-500">{templates.length} class types configured</p>
          <Link href="/founder/schedule">
            <Button size="sm">View Schedule</Button>
          </Link>
        </div>

        {/* Category filter pills */}
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <span
              key={cat.id}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
              style={{ backgroundColor: cat.color + "20", color: cat.color }}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
              {cat.name}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t) => (
            <Card key={t.id} className="p-4">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div
                  className="p-2 rounded-xl"
                  style={{ backgroundColor: t.category.color + "20" }}
                >
                  <Dumbbell className="h-4 w-4" style={{ color: t.category.color }} />
                </div>
                <Badge variant={t.isActive ? "sage" : "default"}>
                  {t.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
              <h3 className="font-semibold text-stone-900">{t.title}</h3>
              <p className="text-xs text-stone-500 mt-0.5">{t.category.name}</p>
              {t.description && (
                <p className="text-xs text-stone-400 mt-2 line-clamp-2">{t.description}</p>
              )}
              <div className="mt-3 flex gap-3 text-xs text-stone-500">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {t.defaultDurationMins} min
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {t._count.sessions} sessions
                </span>
                {t.isWorkshop && <Badge variant="warning">Workshop</Badge>}
              </div>
            </Card>
          ))}

          {templates.length === 0 && (
            <div className="col-span-3 text-center py-12 text-stone-400">
              <Dumbbell className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No class templates yet. Go to Schedule to create classes.</p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

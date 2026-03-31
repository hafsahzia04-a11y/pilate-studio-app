import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatTime, cn } from "@/lib/utils";
import { InstructorAttendance } from "./_components/InstructorAttendance";

export const metadata = { title: "Class Roster" };

export default async function InstructorClassesPage({ searchParams }: { searchParams: { session?: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const profile = await prisma.profile.findUnique({ where: { id: user.id }, select: { fullName: true, email: true, role: true } });
  if (!profile || !["founder", "instructor"].includes(profile.role)) redirect("/login");

  const sessionId = searchParams.session;
  let session = null;
  let bookings: unknown[] = [];

  if (sessionId) {
    session = await prisma.classSession.findUnique({
      where: { id: sessionId },
      include: { category: true },
    });

    if (session && (session.instructorId === user.id || session.substituteInstructorId === user.id || profile.role === "founder")) {
      const raw = await prisma.booking.findMany({
        where: { classSessionId: sessionId, status: { in: ["confirmed", "attended", "no_show"] } },
        include: {
          client: { select: { id: true, fullName: true, clientProfile: { select: { medicalNotes: true, injuryNotes: true } } } },
        },
        orderBy: { createdAt: "asc" },
      });
      bookings = raw;
    }
  }

  // All sessions for this instructor (upcoming)
  const allSessions = await prisma.classSession.findMany({
    where: {
      OR: [{ instructorId: user.id }, { substituteInstructorId: user.id }],
      startTime: { gte: new Date() },
      status: "scheduled",
    },
    include: { category: { select: { name: true, color: true } } },
    orderBy: { startTime: "asc" },
    take: 20,
  });

  return (
    <DashboardLayout role="instructor" userName={profile.fullName} userEmail={profile.email} pageTitle={session ? session.title : "Classes"}>
      <div className="space-y-4">
        {!sessionId ? (
          <div className="space-y-2">
            <p className="text-sm text-stone-500">Select a class to view the roster</p>
            {allSessions.map(s => (
              <a key={s.id} href={`/instructor/classes?session=${s.id}`}>
                <Card className="p-4 hover:shadow-soft transition-shadow cursor-pointer">
                  <p className="font-medium text-stone-900">{s.title}</p>
                  <p className="text-xs text-stone-500 mt-1">{formatDate(s.startTime, "EEE d MMM")} · {formatTime(s.startTime)}</p>
                </Card>
              </a>
            ))}
          </div>
        ) : session ? (
          <div className="space-y-4">
            <Card className="p-4">
              <p className="text-xs text-stone-500">{formatDate(session.startTime, "EEEE, d MMMM yyyy")} · {formatTime(session.startTime)}</p>
              <p className="text-sm font-medium text-stone-700 mt-0.5">{session.category?.name}</p>
            </Card>
            <InstructorAttendance bookings={bookings as Parameters<typeof InstructorAttendance>[0]["bookings"]} sessionId={sessionId} />
          </div>
        ) : (
          <p className="text-stone-400 text-sm">Session not found</p>
        )}
      </div>
    </DashboardLayout>
  );
}

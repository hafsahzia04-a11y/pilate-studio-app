import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export default async function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Ensure profile exists in Prisma
  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    select: { id: true, role: true, fullName: true, email: true, status: true },
  });

  if (!profile) {
    // Profile hasn't been synced yet — sign out and redirect
    redirect("/login");
  }

  if (profile.status === "suspended") {
    redirect("/login?error=suspended");
  }

  return <>{children}</>;
}

import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { MobileNav } from "./MobileNav";
import type { UserRole } from "@prisma/client";

interface DashboardLayoutProps {
  children: React.ReactNode;
  role: UserRole;
  userName: string;
  userEmail: string;
  pageTitle: string;
}

export function DashboardLayout({
  children,
  role,
  userName,
  userEmail,
  pageTitle,
}: DashboardLayoutProps) {
  return (
    <div className="flex min-h-screen bg-cream-100">
      {/* Sidebar — hidden on mobile */}
      <Sidebar role={role} userName={userName} userEmail={userEmail} />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header title={pageTitle} userName={userName} role={role} />
        <main className="flex-1 p-4 md:p-6 pb-24 md:pb-6 overflow-auto">
          {children}
        </main>
      </div>

      {/* Bottom nav — mobile only */}
      <MobileNav role={role} />
    </div>
  );
}

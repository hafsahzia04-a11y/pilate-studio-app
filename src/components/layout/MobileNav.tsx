"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Calendar, Users, UserCheck, Home, ClipboardList, BookOpen,
} from "lucide-react";
import type { UserRole } from "@prisma/client";

const mobileNavByRole: Record<UserRole, Array<{ label: string; href: string; icon: React.ReactNode }>> = {
  founder: [
    { label: "Dashboard", href: "/founder", icon: <LayoutDashboard className="h-5 w-5" /> },
    { label: "Schedule", href: "/founder/schedule", icon: <Calendar className="h-5 w-5" /> },
    { label: "Clients", href: "/founder/clients", icon: <Users className="h-5 w-5" /> },
    { label: "Payments", href: "/founder/payments", icon: <BookOpen className="h-5 w-5" /> },
  ],
  staff: [
    { label: "Home", href: "/staff", icon: <LayoutDashboard className="h-5 w-5" /> },
    { label: "Schedule", href: "/staff/schedule", icon: <Calendar className="h-5 w-5" /> },
    { label: "Check-In", href: "/staff/checkin", icon: <UserCheck className="h-5 w-5" /> },
    { label: "Clients", href: "/staff/clients", icon: <Users className="h-5 w-5" /> },
  ],
  instructor: [
    { label: "Home", href: "/instructor", icon: <LayoutDashboard className="h-5 w-5" /> },
    { label: "Classes", href: "/instructor/classes", icon: <Calendar className="h-5 w-5" /> },
  ],
  client: [
    { label: "Home", href: "/client", icon: <Home className="h-5 w-5" /> },
    { label: "Book", href: "/client/book", icon: <Calendar className="h-5 w-5" /> },
    { label: "Bookings", href: "/client/bookings", icon: <ClipboardList className="h-5 w-5" /> },
    { label: "My Plan", href: "/client/profile", icon: <BookOpen className="h-5 w-5" /> },
  ],
};

export function MobileNav({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const items = mobileNavByRole[role] ?? mobileNavByRole.client;

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-stone-100 z-40 safe-area-bottom">
      <div className="flex items-center justify-around px-2 py-2">
        {items.map((item) => {
          const isActive =
            item.href === `/${role}`
              ? pathname === item.href
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-colors min-w-0",
                isActive ? "text-sage-600" : "text-stone-400"
              )}
            >
              {item.icon}
              <span className="text-[10px] font-medium leading-none">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

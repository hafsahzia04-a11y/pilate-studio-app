"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Calendar,
  Users,
  CreditCard,
  BarChart2,
  Package,
  Settings,
  ShoppingBag,
  ClipboardList,
  UserCheck,
  BookOpen,
  Home,
  LogOut,
  Dumbbell,
  ScrollText,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { UserRole } from "@prisma/client";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: string | number;
}

const navByRole: Record<UserRole, NavItem[]> = {
  founder: [
    { label: "Dashboard", href: "/founder", icon: <LayoutDashboard className="h-4 w-4" /> },
    { label: "Schedule", href: "/founder/schedule", icon: <Calendar className="h-4 w-4" /> },
    { label: "Classes", href: "/founder/classes", icon: <Dumbbell className="h-4 w-4" /> },
    { label: "Clients", href: "/founder/clients", icon: <Users className="h-4 w-4" /> },
    { label: "Instructors", href: "/founder/instructors", icon: <UserCheck className="h-4 w-4" /> },
    { label: "Packages", href: "/founder/packages", icon: <Package className="h-4 w-4" /> },
    { label: "Payments", href: "/founder/payments", icon: <CreditCard className="h-4 w-4" /> },
    { label: "Inventory", href: "/founder/inventory", icon: <ShoppingBag className="h-4 w-4" /> },
    { label: "Analytics", href: "/founder/analytics", icon: <BarChart2 className="h-4 w-4" /> },
    { label: "Audit Log", href: "/founder/audit-logs", icon: <ScrollText className="h-4 w-4" /> },
    { label: "Settings", href: "/founder/settings", icon: <Settings className="h-4 w-4" /> },
  ],
  staff: [
    { label: "Dashboard", href: "/staff", icon: <LayoutDashboard className="h-4 w-4" /> },
    { label: "Schedule", href: "/staff/schedule", icon: <Calendar className="h-4 w-4" /> },
    { label: "Check-In", href: "/staff/checkin", icon: <UserCheck className="h-4 w-4" /> },
    { label: "Clients", href: "/staff/clients", icon: <Users className="h-4 w-4" /> },
  ],
  instructor: [
    { label: "My Classes", href: "/instructor", icon: <LayoutDashboard className="h-4 w-4" /> },
    { label: "Schedule", href: "/instructor/classes", icon: <Calendar className="h-4 w-4" /> },
  ],
  client: [
    { label: "Home", href: "/client", icon: <Home className="h-4 w-4" /> },
    { label: "Book a Class", href: "/client/book", icon: <Calendar className="h-4 w-4" /> },
    { label: "My Bookings", href: "/client/bookings", icon: <ClipboardList className="h-4 w-4" /> },
    { label: "My Package", href: "/client/profile", icon: <BookOpen className="h-4 w-4" /> },
  ],
};

interface SidebarProps {
  role: UserRole;
  userName: string;
  userEmail: string;
}

export function Sidebar({ role, userName, userEmail }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const navItems = navByRole[role] ?? navByRole.client;

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const roleLabels: Record<UserRole, string> = {
    founder: "Founder",
    staff: "Staff",
    instructor: "Instructor",
    client: "Member",
  };

  return (
    <aside className="hidden md:flex flex-col w-60 bg-white border-r border-stone-100 min-h-screen">
      {/* Logo */}
      <div className="px-5 py-6 border-b border-stone-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-sage-500 flex items-center justify-center">
            <span className="text-white font-bold text-sm">M</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-stone-900 leading-none">The Movement</p>
            <p className="text-xs text-stone-400 mt-0.5">Studio</p>
          </div>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive =
            item.href === `/${role}`
              ? pathname === item.href
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all",
                isActive
                  ? "bg-sage-50 text-sage-700 font-medium"
                  : "text-stone-600 hover:bg-cream-100 hover:text-stone-800"
              )}
            >
              <span className={cn(isActive ? "text-sage-600" : "text-stone-400")}>
                {item.icon}
              </span>
              {item.label}
              {item.badge !== undefined && (
                <span className="ml-auto text-xs bg-red-100 text-red-600 rounded-full px-1.5 py-0.5 font-medium">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="p-3 border-t border-stone-100">
        <div className="flex items-center gap-3 px-2 py-2 rounded-xl">
          <div className="w-8 h-8 rounded-full bg-sage-100 flex items-center justify-center flex-shrink-0">
            <span className="text-sage-700 text-xs font-semibold">
              {userName.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-stone-800 truncate">{userName}</p>
            <p className="text-xs text-stone-400 truncate">{roleLabels[role]}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="text-stone-400 hover:text-stone-600 transition-colors"
            title="Sign out"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}

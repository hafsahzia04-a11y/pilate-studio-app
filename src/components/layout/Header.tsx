"use client";

import { Bell, Menu, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import type { UserRole } from "@prisma/client";

interface HeaderProps {
  title: string;
  userName: string;
  role: UserRole;
}

export function Header({ title, userName, role }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const roleColors: Record<UserRole, string> = {
    founder: "bg-amber-100 text-amber-700",
    staff: "bg-blue-100 text-blue-700",
    instructor: "bg-purple-100 text-purple-700",
    client: "bg-sage-100 text-sage-700",
  };

  const roleLabel: Record<UserRole, string> = {
    founder: "Founder",
    staff: "Staff",
    instructor: "Instructor",
    client: "Member",
  };

  return (
    <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-stone-100 px-4 md:px-6 py-3">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Title (desktop) + Logo (mobile) */}
        <div className="flex items-center gap-3">
          <div className="md:hidden flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-sage-500 flex items-center justify-center">
              <span className="text-white font-bold text-xs">M</span>
            </div>
          </div>
          <h1 className="text-base md:text-lg font-semibold text-stone-900 truncate">
            {title}
          </h1>
        </div>

        {/* Right: Role badge + initials */}
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "hidden sm:inline-flex text-xs font-medium px-2.5 py-1 rounded-full",
              roleColors[role]
            )}
          >
            {roleLabel[role]}
          </span>
          <div className="w-8 h-8 rounded-full bg-sage-100 flex items-center justify-center">
            <span className="text-sage-700 text-xs font-semibold">
              {userName.charAt(0).toUpperCase()}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-stone-100 text-stone-700",
        sage: "bg-sage-100 text-sage-700",
        success: "bg-sage-100 text-sage-700",
        warning: "bg-amber-100 text-amber-700",
        danger: "bg-red-100 text-red-600",
        blue: "bg-blue-100 text-blue-700",
        purple: "bg-purple-100 text-purple-700",
        rose: "bg-rose-100 text-rose-600",
        outline: "border border-stone-200 text-stone-600 bg-transparent",
        // Status-specific
        active: "bg-sage-100 text-sage-700",
        expired: "bg-red-100 text-red-600",
        paused: "bg-amber-100 text-amber-700",
        founding: "bg-amber-50 text-amber-800 border border-amber-200",
        vip: "bg-purple-100 text-purple-700",
        student: "bg-blue-100 text-blue-700",
        overdue: "bg-red-100 text-red-600",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };

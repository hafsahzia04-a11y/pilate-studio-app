import * as React from "react";
import { cn } from "@/lib/utils";
import { Card } from "./card";
import { TrendingUp, TrendingDown } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: number;         // Positive = up, negative = down
  trendLabel?: string;
  color?: "sage" | "amber" | "red" | "blue" | "purple" | "stone";
  className?: string;
  onClick?: () => void;
}

const colorClasses = {
  sage: "bg-sage-50 text-sage-600",
  amber: "bg-amber-50 text-amber-600",
  red: "bg-red-50 text-red-500",
  blue: "bg-blue-50 text-blue-600",
  purple: "bg-purple-50 text-purple-600",
  stone: "bg-stone-100 text-stone-500",
};

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  trendLabel,
  color = "sage",
  className,
  onClick,
}: StatCardProps) {
  return (
    <Card
      className={cn(
        "p-5",
        onClick && "cursor-pointer hover:shadow-soft transition-shadow",
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-stone-500 uppercase tracking-wide truncate">
            {title}
          </p>
          <p className="mt-1.5 text-2xl font-bold text-stone-900 leading-none">
            {value}
          </p>
          {subtitle && (
            <p className="mt-1 text-xs text-stone-500">{subtitle}</p>
          )}
          {trend !== undefined && (
            <div
              className={cn(
                "mt-2 flex items-center gap-1 text-xs font-medium",
                trend >= 0 ? "text-sage-600" : "text-red-500"
              )}
            >
              {trend >= 0 ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              <span>
                {trend >= 0 ? "+" : ""}
                {trend}% {trendLabel}
              </span>
            </div>
          )}
        </div>

        {icon && (
          <div
            className={cn(
              "flex-shrink-0 p-2.5 rounded-xl",
              colorClasses[color]
            )}
          >
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}

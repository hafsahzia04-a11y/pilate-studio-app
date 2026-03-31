import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow, isAfter, isBefore, addDays } from "date-fns";

// ─── Tailwind class merge helper ─────────────────────────────────────────────
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── Currency ────────────────────────────────────────────────────────────────
export function formatCurrency(
  amount: number | string | { toNumber: () => number },
  currency = "AED"
): string {
  const num =
    typeof amount === "object" && "toNumber" in amount
      ? amount.toNumber()
      : Number(amount);

  return new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num);
}

// ─── Dates ───────────────────────────────────────────────────────────────────
export function formatDate(date: Date | string, fmt = "dd MMM yyyy"): string {
  return format(new Date(date), fmt);
}

export function formatDateTime(date: Date | string): string {
  return format(new Date(date), "dd MMM yyyy, h:mm a");
}

export function formatTime(date: Date | string): string {
  return format(new Date(date), "h:mm a");
}

export function timeAgo(date: Date | string): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function daysUntil(date: Date | string): number {
  const now = new Date();
  const target = new Date(date);
  const diff = target.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function isExpired(date: Date | string): boolean {
  return isBefore(new Date(date), new Date());
}

export function isExpiringSoon(date: Date | string, withinDays = 7): boolean {
  const target = new Date(date);
  const threshold = addDays(new Date(), withinDays);
  return isAfter(threshold, target) && !isExpired(date);
}

// ─── Phone sanitisation ───────────────────────────────────────────────────────
export function sanitisePhone(phone: string): string {
  return phone.replace(/[\s\-\+\(\)]/g, "");
}

// ─── Percentage ───────────────────────────────────────────────────────────────
export function applyDiscount(price: number, discountPercent: number): number {
  return price * (1 - discountPercent / 100);
}

// ─── Credit status colour ─────────────────────────────────────────────────────
export function creditStatusColor(remaining: number, total: number): string {
  if (total === 0) return "stone";
  const pct = remaining / total;
  if (pct > 0.5) return "sage";
  if (pct > 0.25) return "amber";
  return "red";
}

// ─── Booking status display ───────────────────────────────────────────────────
export function bookingStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    confirmed: "Confirmed",
    attended: "Attended",
    cancelled: "Cancelled",
    late_cancelled: "Late Cancel",
    no_show: "No Show",
    waitlisted: "Waitlisted",
  };
  return labels[status] ?? status;
}

export function bookingStatusColor(status: string): string {
  const colors: Record<string, string> = {
    confirmed: "bg-sage-100 text-sage-700",
    attended: "bg-sage-200 text-sage-800",
    cancelled: "bg-stone-100 text-stone-500",
    late_cancelled: "bg-amber-100 text-amber-700",
    no_show: "bg-red-100 text-red-600",
    waitlisted: "bg-blue-100 text-blue-700",
  };
  return colors[status] ?? "bg-stone-100 text-stone-500";
}

// ─── Payment status display ───────────────────────────────────────────────────
export function paymentStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    paid: "Paid",
    partial: "Partial",
    unpaid: "Unpaid",
    overdue: "Overdue",
    refunded: "Refunded",
  };
  return labels[status] ?? status;
}

export function paymentStatusColor(status: string): string {
  const colors: Record<string, string> = {
    paid: "bg-sage-100 text-sage-700",
    partial: "bg-amber-100 text-amber-700",
    unpaid: "bg-stone-100 text-stone-500",
    overdue: "bg-red-100 text-red-600",
    refunded: "bg-blue-100 text-blue-700",
  };
  return colors[status] ?? "bg-stone-100 text-stone-500";
}

// ─── Initials avatar ─────────────────────────────────────────────────────────
export function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? "")
    .join("");
}

// ─── Truncate ─────────────────────────────────────────────────────────────────
export function truncate(str: string, maxLen: number): string {
  return str.length > maxLen ? str.slice(0, maxLen) + "…" : str;
}

// ─── Class occupancy colour ───────────────────────────────────────────────────
export function occupancyColor(booked: number, capacity: number): string {
  const pct = booked / capacity;
  if (pct >= 1) return "text-red-600 bg-red-50";
  if (pct >= 0.8) return "text-amber-600 bg-amber-50";
  return "text-sage-600 bg-sage-50";
}

export function occupancyLabel(booked: number, capacity: number): string {
  if (booked >= capacity) return "Full";
  const spots = capacity - booked;
  return `${spots} spot${spots !== 1 ? "s" : ""} left`;
}

// ─── Error response helper ─────────────────────────────────────────────────────
export function apiError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export function apiSuccess<T>(data: T, status = 200) {
  return Response.json(data, { status });
}

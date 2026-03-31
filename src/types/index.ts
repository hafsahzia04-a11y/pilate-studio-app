// ─────────────────────────────────────────────────────────────────────────────
// Shared TypeScript types across the application
// ─────────────────────────────────────────────────────────────────────────────

import type { UserRole, BookingStatus, PaymentStatus, ClientPackageStatus } from "@prisma/client";

// ─── Auth / Session ───────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  fullName: string;
  phone?: string | null;
  avatarUrl?: string | null;
}

// ─── Dashboard stats ──────────────────────────────────────────────────────────

export interface DashboardStats {
  totalActiveMembers: number;
  classesToday: number;
  bookingsToday: number;
  revenueThisMonth: number;
  overduePayments: number;
  expiringThisWeek: number;
  lowStockProducts: number;
  openWaitlistSpots: number;
}

// ─── Class Session (enriched for UI) ─────────────────────────────────────────

export interface ClassSessionWithDetails {
  id: string;
  title: string;
  category: { name: string; color: string };
  instructor: { id: string; fullName: string };
  substituteInstructor?: { id: string; fullName: string } | null;
  room?: string | null;
  startTime: Date;
  endTime: Date;
  durationMins: number;
  capacity: number;
  isWorkshop: boolean;
  workshopPrice?: number | null;
  usesCredits: boolean;
  status: string;
  bookedCount: number;
  waitlistCount: number;
  spotsLeft: number;
  isFull: boolean;
}

// ─── Client (enriched for staff view) ─────────────────────────────────────────

export interface ClientWithPackage {
  id: string;
  fullName: string;
  email: string;
  phone?: string | null;
  status: string;
  clientProfile?: {
    tags: string[];
    staffNotes?: string | null;
    waiverSignedAt?: Date | null;
  } | null;
  activePackage?: {
    id: string;
    package: { name: string; type: string };
    remainingCredits: number;
    totalCredits: number;
    expiryDate: Date;
    paymentStatus: PaymentStatus;
    status: ClientPackageStatus;
    guestPassesRemaining: number;
    drinksRemaining: number;
  } | null;
}

// ─── Booking (enriched for roster) ───────────────────────────────────────────

export interface BookingWithClient {
  id: string;
  status: BookingStatus;
  creditDeducted: boolean;
  isGuestBooking: boolean;
  guestName?: string | null;
  client: {
    id: string;
    fullName: string;
    phone?: string | null;
    clientProfile?: { tags: string[]; medicalNotes?: string | null } | null;
  };
  clientPackage?: {
    package: { name: string };
    remainingCredits: number;
  } | null;
  createdAt: Date;
}

// ─── Package (enriched) ───────────────────────────────────────────────────────

export interface PackageWithStats {
  id: string;
  name: string;
  type: string;
  price: number;
  classCredits: number;
  validityDays: number;
  guestPassesPerPeriod: number;
  workshopDiscountPercent: number;
  drinksPerPeriod: number;
  bookingWindowHours?: number | null;
  priorityBooking: boolean;
  minCommitmentMonths: number;
  priceLockMonths: number;
  maxQuantity?: number | null;
  soldCount: number;
  requiresStudentId: boolean;
  isFounding: boolean;
  isActive: boolean;
  isVisible: boolean;
  description?: string | null;
  activePurchases?: number;
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export interface RevenueDataPoint {
  date: string;
  revenue: number;
  bookings: number;
}

export interface OccupancyDataPoint {
  className: string;
  booked: number;
  capacity: number;
  percentage: number;
}

export interface PackageSalesData {
  packageName: string;
  count: number;
  revenue: number;
}

// ─── API response helpers ─────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  message?: string;
}

// ─── Form types ───────────────────────────────────────────────────────────────

export interface CreateClassSessionForm {
  title: string;
  categoryId: string;
  instructorId: string;
  room?: string;
  startTime: string;      // ISO string from datetime-local input
  durationMins: number;
  capacity: number;
  isWorkshop: boolean;
  workshopPrice?: number;
  usesCredits: boolean;
  description?: string;
  templateId?: string;
  recurringRuleId?: string;
}

export interface CreatePackageForm {
  name: string;
  type: string;
  price: number;
  classCredits: number;
  validityDays: number;
  guestPassesPerPeriod: number;
  workshopDiscountPercent: number;
  drinksPerPeriod: number;
  bookingWindowHours?: number;
  priorityBooking: boolean;
  minCommitmentMonths: number;
  priceLockMonths: number;
  maxQuantity?: number;
  requiresStudentId: boolean;
  isFounding: boolean;
  isActive: boolean;
  isVisible: boolean;
  description?: string;
}

export interface SellPackageForm {
  clientId: string;
  packageId: string;
  startDate: string;
  paymentMethod: string;
  amountPaid: number;
  notes?: string;
  staffNotes?: string;
}

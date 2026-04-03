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

// ─── Full Client Profile (from GET /api/clients/[id]) ────────────────────────

export interface ClientPackageDetail {
  id: string;
  packageId: string;
  package: {
    id: string;
    name: string;
    type: string;
    price: number;
    classCredits: number;
    validityDays: number;
    guestPassesPerPeriod: number;
    workshopDiscountPercent: number;
    drinksPerPeriod: number;
    priorityBooking: boolean;
    isFounding: boolean;
    description?: string | null;
  };
  startDate: Date;
  expiryDate: Date;
  renewalDate?: Date | null;
  totalCredits: number;
  usedCredits: number;
  remainingCredits: number;
  guestPassesRemaining: number;
  drinksRemaining: number;
  amountPaid: number;
  amountDue: number;
  paymentStatus: string;
  paymentDueDate?: Date | null;
  status: string;
  lockedPrice?: number | null;
  notes?: string | null;
  createdAt: Date;
  payments?: {
    id: string;
    amount: number;
    paymentMethod: string;
    status: string;
    paidAt?: Date | null;
    notes?: string | null;
    createdAt: Date;
  }[];
}

export interface FullClientProfile {
  id: string;
  fullName: string;
  email: string;
  phone?: string | null;
  status: string;
  role: string;
  createdAt: Date;
  clientProfile?: {
    dateOfBirth?: Date | null;
    gender?: string | null;
    emergencyContactName?: string | null;
    emergencyContactPhone?: string | null;
    medicalNotes?: string | null;
    injuryNotes?: string | null;
    tags: string[];
    staffNotes?: string | null;
    waiverSignedAt?: Date | null;
    referralCode?: string | null;
  } | null;
  clientPackages: ClientPackageDetail[];
  bookings: {
    id: string;
    status: string;
    creditDeducted: boolean;
    createdAt: Date;
    classSession: {
      id: string;
      title: string;
      startTime: Date;
      endTime?: Date;
      room?: string | null;
      category: { name: string; color: string };
      instructor: { fullName: string };
    };
    clientPackage?: {
      package: { name: string };
      remainingCredits: number;
    } | null;
  }[];
}

// ─── Registration Wizard State ────────────────────────────────────────────────

export interface RegistrationDetails {
  fullName: string;
  email: string;
  phone: string;
  age?: string;
  notes?: string;
}

export interface RegistrationPayment {
  paymentStatus: "paid" | "partial" | "unpaid";
  amountPaid: number;
  paymentMethod: string;
  dueDate?: string;
  notes?: string;
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

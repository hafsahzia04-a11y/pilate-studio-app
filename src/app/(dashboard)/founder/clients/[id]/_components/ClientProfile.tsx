"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import Link from "next/link";
import {
  ArrowLeft, User, Package2, CreditCard, Calendar, Coffee, Users,
  Percent, Clock, ChevronDown, CheckCircle2, AlertCircle, RefreshCw,
  PlusCircle, Edit2, History, MoreHorizontal, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/modal";
import {
  cn,
  formatDate,
  formatDateTime,
  formatTime,
  formatCurrency,
  computeEffectivePaymentStatus,
  daysUntil,
  bookingStatusColor,
  bookingStatusLabel,
} from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Payment {
  id: string;
  amount: number;
  netAmount: number;
  paymentMethod: string;
  status: string;
  paidAt?: string | null;
  notes?: string | null;
  createdAt: string;
}

interface ClientPackage {
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
  startDate: string;
  expiryDate: string;
  renewalDate?: string | null;
  totalCredits: number;
  usedCredits: number;
  remainingCredits: number;
  guestPassesRemaining: number;
  drinksRemaining: number;
  amountPaid: number;
  amountDue: number;
  paymentStatus: string;
  paymentDueDate?: string | null;
  status: string;
  lockedPrice?: number | null;
  notes?: string | null;
  createdAt: string;
  payments: Payment[];
}

interface Booking {
  id: string;
  status: string;
  creditDeducted: boolean;
  createdAt: string;
  classSession: {
    id: string;
    title: string;
    startTime: string;
    endTime: string;
    room?: string | null;
    category: { name: string; color: string };
    instructor: { fullName: string };
  };
  clientPackage?: { package: { name: string }; remainingCredits: number } | null;
}

interface ClientData {
  id: string;
  fullName: string;
  email: string;
  phone?: string | null;
  status: string;
  createdAt: string;
  clientProfile?: {
    dateOfBirth?: string | null;
    gender?: string | null;
    emergencyContactName?: string | null;
    emergencyContactPhone?: string | null;
    medicalNotes?: string | null;
    injuryNotes?: string | null;
    tags: string[];
    staffNotes?: string | null;
    waiverSignedAt?: string | null;
    referralCode?: string | null;
  } | null;
  clientPackages: ClientPackage[];
  bookings: Booking[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function paymentStatusBadge(status: string) {
  const variants: Record<string, "sage" | "warning" | "danger" | "default"> = {
    paid: "sage",
    partial: "warning",
    unpaid: "default",
    overdue: "danger",
    refunded: "blue" as never,
  };
  const labels: Record<string, string> = {
    paid: "Paid",
    partial: "Partial",
    unpaid: "Unpaid",
    overdue: "Overdue",
    refunded: "Refunded",
  };
  return <Badge variant={variants[status] ?? "default"}>{labels[status] ?? status}</Badge>;
}

function packageStatusBadge(cp: ClientPackage) {
  const effective = computeEffectivePaymentStatus(cp.paymentStatus, cp.paymentDueDate);
  if (cp.status === "expired") return <Badge variant="danger">Expired</Badge>;
  if (cp.status === "cancelled") return <Badge variant="default">Cancelled</Badge>;
  if (cp.status === "paused") return <Badge variant="warning">Paused</Badge>;
  if (effective === "overdue") return <Badge variant="danger">Overdue</Badge>;
  const daysLeft = daysUntil(cp.expiryDate);
  if (daysLeft <= 0) return <Badge variant="danger">Expired</Badge>;
  if (daysLeft <= 7) return <Badge variant="warning">Expiring Soon</Badge>;
  return <Badge variant="sage">Active</Badge>;
}

function rowBorderColor(cp: ClientPackage): string {
  const effective = computeEffectivePaymentStatus(cp.paymentStatus, cp.paymentDueDate);
  if (effective === "overdue" || cp.status === "expired") return "border-l-4 border-l-red-400";
  const daysLeft = daysUntil(cp.expiryDate);
  if (daysLeft <= 7 || effective === "partial") return "border-l-4 border-l-amber-400";
  if (effective === "paid" && cp.status === "active") return "border-l-4 border-l-sage-400";
  return "";
}

// ─── Sub-component: PerkRow ────────────────────────────────────────────────────

function PerkRow({
  label,
  icon,
  total,
  used,
  remaining,
  onUse,
  loading,
}: {
  label: string;
  icon: React.ReactNode;
  total: number;
  used: number;
  remaining: number;
  onUse: () => void;
  loading: boolean;
}) {
  if (total === 0) {
    return (
      <div className="flex items-center justify-between py-3 border-b border-stone-100 last:border-0">
        <div className="flex items-center gap-2 text-stone-400">
          {icon}
          <span className="text-sm">{label}</span>
        </div>
        <span className="text-xs text-stone-400 bg-stone-100 px-2 py-0.5 rounded-lg">Not included</span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between py-3 border-b border-stone-100 last:border-0">
      <div className="flex items-center gap-3">
        <div className="text-sage-600">{icon}</div>
        <div>
          <p className="text-sm font-medium text-stone-800">{label}</p>
          <p className="text-xs text-stone-500">
            {used} used · {remaining} remaining of {total}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {/* Progress dots */}
        <div className="flex gap-1">
          {Array.from({ length: total }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "w-2.5 h-2.5 rounded-full",
                i < used ? "bg-stone-300" : "bg-sage-400"
              )}
            />
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onUse}
          disabled={remaining === 0 || loading}
          loading={loading}
          className="text-xs"
        >
          Mark Used
        </Button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  client: ClientData;
}

type ActiveTab = "package" | "bookings" | "history";

export function ClientProfile({ client }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ActiveTab>("package");
  const [packages, setPackages] = useState<ClientPackage[]>(client.clientPackages);

  // Active package = first active one
  const activePackage = packages.find((cp) => cp.status === "active") ?? packages[0] ?? null;

  // Modal states
  const [recordPaymentOpen, setRecordPaymentOpen] = useState(false);
  const [renewOpen, setRenewOpen] = useState(false);
  const [guestPassConfirm, setGuestPassConfirm] = useState(false);
  const [drinkConfirm, setDrinkConfirm] = useState(false);
  const [perkLoading, setPerkLoading] = useState<"guest" | "drink" | null>(null);

  // Payment form state
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [payNotes, setPayNotes] = useState("");
  const [payLoading, setPayLoading] = useState(false);

  // Renew form state
  const [renewLoading, setRenewLoading] = useState(false);
  const [renewStartDate, setRenewStartDate] = useState(
    new Date().toISOString().substring(0, 10)
  );
  const [renewAmountPaid, setRenewAmountPaid] = useState("");
  const [renewMethod, setRenewMethod] = useState("cash");

  async function handlePerk(action: "use_guest_pass" | "use_drink") {
    if (!activePackage) return;
    setPerkLoading(action === "use_guest_pass" ? "guest" : "drink");
    try {
      const res = await fetch(`/api/client-packages/${activePackage.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setPackages((prev) =>
        prev.map((cp) =>
          cp.id === activePackage.id
            ? {
                ...cp,
                guestPassesRemaining: data.guestPassesRemaining,
                drinksRemaining: data.drinksRemaining,
              }
            : cp
        )
      );
      toast.success(action === "use_guest_pass" ? "Guest pass marked as used" : "Wellness drink marked as used");
      setGuestPassConfirm(false);
      setDrinkConfirm(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setPerkLoading(null);
    }
  }

  async function handleRecordPayment() {
    if (!activePackage || !payAmount) return;
    setPayLoading(true);
    try {
      const res = await fetch(`/api/client-packages/${activePackage.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "record_payment",
          amount: Number(payAmount),
          paymentMethod: payMethod,
          notes: payNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setPackages((prev) =>
        prev.map((cp) =>
          cp.id === activePackage.id
            ? {
                ...cp,
                amountPaid: data.amountPaid,
                paymentStatus: data.paymentStatus,
                payments: data.payment ? [data.payment, ...cp.payments] : cp.payments,
              }
            : cp
        )
      );
      toast.success("Payment recorded");
      setRecordPaymentOpen(false);
      setPayAmount("");
      setPayNotes("");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setPayLoading(false);
    }
  }

  async function handleRenew() {
    if (!activePackage) return;
    setRenewLoading(true);
    try {
      const res = await fetch(`/api/client-packages/${activePackage.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "renew",
          startDate: renewStartDate,
          amountPaid: renewAmountPaid ? Number(renewAmountPaid) : 0,
          paymentMethod: renewMethod,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      toast.success("Package renewed successfully!");
      setRenewOpen(false);
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setRenewLoading(false);
    }
  }

  const tags = client.clientProfile?.tags ?? [];
  const now = new Date();
  const upcomingBookings = client.bookings.filter(
    (b) => new Date(b.classSession.startTime) >= now && b.status !== "cancelled"
  );
  const pastBookings = client.bookings.filter(
    (b) => new Date(b.classSession.startTime) < now || b.status === "cancelled"
  );

  const effectivePayStatus = activePackage
    ? computeEffectivePaymentStatus(activePackage.paymentStatus, activePackage.paymentDueDate)
    : null;

  return (
    <div className="space-y-5 animate-fade-in max-w-4xl mx-auto">
      {/* Back + header */}
      <div className="flex items-start gap-4">
        <Link href="/founder/clients">
          <Button variant="ghost" size="icon-sm" title="Back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Avatar */}
            <div className="w-12 h-12 rounded-full bg-sage-100 text-sage-700 flex items-center justify-center text-base font-bold flex-shrink-0">
              {client.fullName.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl font-bold text-stone-900">{client.fullName}</h1>
              <p className="text-sm text-stone-500">
                {client.email}
                {client.phone ? ` · ${client.phone}` : ""}
              </p>
            </div>
            {/* Tags */}
            <div className="flex flex-wrap gap-1 ml-auto">
              {tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
              ))}
              {client.status !== "active" && (
                <Badge variant="danger">{client.status}</Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quick action bar */}
      <div className="flex flex-wrap gap-2">
        {activePackage && (
          <>
            <Button size="sm" onClick={() => setRecordPaymentOpen(true)}>
              <CreditCard className="h-3.5 w-3.5" />
              Record Payment
            </Button>
            <Button size="sm" variant="outline" onClick={() => setRenewOpen(true)}>
              <RefreshCw className="h-3.5 w-3.5" />
              Renew Package
            </Button>
          </>
        )}
        <Link href={`/founder/clients/new?prefill=${client.id}`}>
          <Button size="sm" variant="outline">
            <PlusCircle className="h-3.5 w-3.5" />
            New Package
          </Button>
        </Link>
        <Link href={`/founder/clients/${client.id}/edit`}>
          <Button size="sm" variant="ghost">
            <Edit2 className="h-3.5 w-3.5" />
            Edit Profile
          </Button>
        </Link>
      </div>

      {/* Overdue alert banner */}
      {effectivePayStatus === "overdue" && (
        <div className="flex items-center gap-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-800">Payment Overdue</p>
            <p className="text-xs text-red-600">
              Outstanding: {formatCurrency(activePackage!.amountDue - activePackage!.amountPaid)}
              {activePackage?.paymentDueDate
                ? ` · Due date was ${formatDate(activePackage.paymentDueDate)}`
                : ""}
            </p>
          </div>
          <Button
            size="sm"
            variant="destructive"
            className="ml-auto"
            onClick={() => setRecordPaymentOpen(true)}
          >
            Record Payment
          </Button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-stone-100 p-1 rounded-xl w-fit">
        {(["package", "bookings", "history"] as ActiveTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-4 py-1.5 rounded-lg text-sm font-medium transition-all capitalize",
              activeTab === tab
                ? "bg-white text-stone-900 shadow-sm"
                : "text-stone-500 hover:text-stone-700"
            )}
          >
            {tab === "package" ? "Package & Perks" : tab === "bookings" ? "Bookings" : "History"}
          </button>
        ))}
      </div>

      {/* ── TAB: Package & Perks ── */}
      {activeTab === "package" && (
        <div className="space-y-4">
          {!activePackage ? (
            <Card className="p-8 text-center">
              <Package2 className="h-10 w-10 text-stone-300 mx-auto mb-3" />
              <p className="text-stone-500 text-sm font-medium">No active package</p>
              <p className="text-stone-400 text-xs mt-1">Assign a package to this client to get started.</p>
              <div className="mt-4">
                <Link href={`/founder/clients/new`}>
                  <Button size="sm">Assign Package</Button>
                </Link>
              </div>
            </Card>
          ) : (
            <>
              {/* Active package card */}
              <Card className={cn("p-5", rowBorderColor(activePackage))}>
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <p className="font-bold text-stone-900 text-base">{activePackage.package.name}</p>
                    <p className="text-xs text-stone-500 mt-0.5">
                      Started {formatDate(activePackage.startDate)} · Expires {formatDate(activePackage.expiryDate)}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1 items-end">
                    {packageStatusBadge(activePackage)}
                    {paymentStatusBadge(effectivePayStatus!)}
                  </div>
                </div>

                {/* Credits progress */}
                <div className="mb-4">
                  <div className="flex justify-between text-xs text-stone-500 mb-1">
                    <span>Classes Used</span>
                    <span className="font-semibold text-stone-800">
                      {activePackage.usedCredits} / {activePackage.totalCredits}
                    </span>
                  </div>
                  <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-sage-400 rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, (activePackage.usedCredits / Math.max(1, activePackage.totalCredits)) * 100)}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-stone-500 mt-1">
                    {activePackage.remainingCredits} classes remaining
                  </p>
                </div>

                {/* Payment info */}
                <div className="grid grid-cols-3 gap-3 text-center bg-stone-50 rounded-xl p-3">
                  <div>
                    <p className="text-xs text-stone-400">Total Due</p>
                    <p className="font-bold text-stone-800 text-sm">{formatCurrency(activePackage.amountDue)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-stone-400">Paid</p>
                    <p className="font-bold text-sage-700 text-sm">{formatCurrency(activePackage.amountPaid)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-stone-400">Outstanding</p>
                    <p
                      className={cn(
                        "font-bold text-sm",
                        activePackage.amountDue - activePackage.amountPaid > 0
                          ? "text-red-600"
                          : "text-sage-600"
                      )}
                    >
                      {formatCurrency(Math.max(0, activePackage.amountDue - activePackage.amountPaid))}
                    </p>
                  </div>
                </div>

                {activePackage.paymentDueDate && effectivePayStatus !== "paid" && (
                  <p
                    className={cn(
                      "text-xs mt-2",
                      effectivePayStatus === "overdue" ? "text-red-600 font-medium" : "text-stone-500"
                    )}
                  >
                    {effectivePayStatus === "overdue" ? "⚠ " : ""}
                    Payment due: {formatDate(activePackage.paymentDueDate)}
                  </p>
                )}
              </Card>

              {/* Perks panel */}
              <Card className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Gift className="h-4 w-4 text-sage-500" />
                  <h3 className="font-semibold text-stone-800 text-sm">Package Perks</h3>
                </div>

                <PerkRow
                  label="Guest Passes"
                  icon={<Users className="h-4 w-4" />}
                  total={activePackage.package.guestPassesPerPeriod}
                  used={activePackage.package.guestPassesPerPeriod - activePackage.guestPassesRemaining}
                  remaining={activePackage.guestPassesRemaining}
                  onUse={() => setGuestPassConfirm(true)}
                  loading={perkLoading === "guest"}
                />
                <PerkRow
                  label="Wellness Drinks"
                  icon={<Coffee className="h-4 w-4" />}
                  total={activePackage.package.drinksPerPeriod}
                  used={activePackage.package.drinksPerPeriod - activePackage.drinksRemaining}
                  remaining={activePackage.drinksRemaining}
                  onUse={() => setDrinkConfirm(true)}
                  loading={perkLoading === "drink"}
                />

                {/* Workshop discount */}
                <div className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <Percent className="h-4 w-4 text-sage-600" />
                    <div>
                      <p className="text-sm font-medium text-stone-800">Workshop Discount</p>
                    </div>
                  </div>
                  {activePackage.package.workshopDiscountPercent > 0 ? (
                    <Badge variant="purple">{activePackage.package.workshopDiscountPercent}% off</Badge>
                  ) : (
                    <span className="text-xs text-stone-400 bg-stone-100 px-2 py-0.5 rounded-lg">Not included</span>
                  )}
                </div>
              </Card>

              {/* Payment history */}
              {activePackage.payments.length > 0 && (
                <Card className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <CreditCard className="h-4 w-4 text-sage-500" />
                    <h3 className="font-semibold text-stone-800 text-sm">Payment History</h3>
                  </div>
                  <div className="space-y-0 divide-y divide-stone-100">
                    {activePackage.payments.map((p) => (
                      <div key={p.id} className="flex items-center justify-between py-2.5 text-sm">
                        <div>
                          <p className="font-medium text-stone-800">{formatCurrency(p.amount)}</p>
                          <p className="text-xs text-stone-400 capitalize">
                            {p.paymentMethod.replace("_", " ")}
                            {p.notes ? ` · ${p.notes}` : ""}
                          </p>
                        </div>
                        <p className="text-xs text-stone-500">
                          {p.paidAt ? formatDate(p.paidAt) : formatDate(p.createdAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </>
          )}
        </div>
      )}

      {/* ── TAB: Bookings ── */}
      {activeTab === "bookings" && (
        <div className="space-y-4">
          {/* Upcoming */}
          <div>
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">
              Upcoming ({upcomingBookings.length})
            </p>
            {upcomingBookings.length === 0 ? (
              <Card className="p-6 text-center text-stone-400 text-sm">No upcoming bookings.</Card>
            ) : (
              <div className="space-y-2">
                {upcomingBookings.map((b) => (
                  <Card key={b.id} className="p-4 flex items-center gap-3">
                    <div
                      className="w-1 h-10 rounded-full flex-shrink-0"
                      style={{ backgroundColor: b.classSession.category.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-stone-800 text-sm truncate">
                        {b.classSession.title}
                      </p>
                      <p className="text-xs text-stone-500">
                        {formatDate(b.classSession.startTime)} at {formatTime(b.classSession.startTime)}
                        {" · "}
                        {b.classSession.instructor.fullName}
                      </p>
                    </div>
                    <span className={cn("text-xs px-2 py-0.5 rounded-lg font-medium", bookingStatusColor(b.status))}>
                      {bookingStatusLabel(b.status)}
                    </span>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Past */}
          <div>
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">
              Past ({pastBookings.length})
            </p>
            {pastBookings.length === 0 ? (
              <Card className="p-6 text-center text-stone-400 text-sm">No past bookings.</Card>
            ) : (
              <div className="space-y-2">
                {pastBookings.slice(0, 20).map((b) => (
                  <Card key={b.id} className="p-3 flex items-center gap-3 opacity-80">
                    <div
                      className="w-1 h-8 rounded-full flex-shrink-0"
                      style={{ backgroundColor: b.classSession.category.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-stone-700 truncate">{b.classSession.title}</p>
                      <p className="text-xs text-stone-400">
                        {formatDate(b.classSession.startTime)} at {formatTime(b.classSession.startTime)}
                      </p>
                    </div>
                    <span className={cn("text-xs px-2 py-0.5 rounded-lg", bookingStatusColor(b.status))}>
                      {bookingStatusLabel(b.status)}
                    </span>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: History ── */}
      {activeTab === "history" && (
        <div className="space-y-3">
          <p className="text-xs text-stone-500">All package cycles for this client.</p>
          {packages.length === 0 ? (
            <Card className="p-8 text-center text-stone-400 text-sm">No package history.</Card>
          ) : (
            packages.map((cp) => {
              const effPay = computeEffectivePaymentStatus(cp.paymentStatus, cp.paymentDueDate);
              return (
                <Card key={cp.id} className={cn("p-4", rowBorderColor(cp))}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-stone-800 text-sm">{cp.package.name}</p>
                      <p className="text-xs text-stone-500 mt-0.5">
                        {formatDate(cp.startDate)} → {formatDate(cp.expiryDate)}
                      </p>
                    </div>
                    <div className="flex gap-1 flex-wrap justify-end">
                      <Badge variant={cp.status === "active" ? "sage" : cp.status === "expired" ? "danger" : "default"}>
                        {cp.status}
                      </Badge>
                      {paymentStatusBadge(effPay)}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-500">
                    <span>{cp.usedCredits}/{cp.totalCredits} classes used</span>
                    <span>{formatCurrency(cp.amountPaid)} paid of {formatCurrency(cp.amountDue)}</span>
                    {cp.guestPassesRemaining < cp.package.guestPassesPerPeriod && (
                      <span>{cp.package.guestPassesPerPeriod - cp.guestPassesRemaining} guest passes used</span>
                    )}
                    {cp.drinksRemaining < cp.package.drinksPerPeriod && (
                      <span>{cp.package.drinksPerPeriod - cp.drinksRemaining} drinks used</span>
                    )}
                  </div>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* ── Modals ── */}

      {/* Record Payment */}
      <Modal
        open={recordPaymentOpen}
        onOpenChange={setRecordPaymentOpen}
        title="Record Payment"
        description={activePackage ? `${activePackage.package.name} — Outstanding: ${formatCurrency(activePackage.amountDue - activePackage.amountPaid)}` : ""}
        size="sm"
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-stone-700">Amount (PKR)</label>
            <input
              type="number"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              placeholder={activePackage ? String(activePackage.amountDue - activePackage.amountPaid) : ""}
              min={1}
              className="w-full h-10 px-3 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-sage-400 focus:ring-2 focus:ring-sage-100"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-stone-700">Payment Method</label>
            <select
              value={payMethod}
              onChange={(e) => setPayMethod(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-sage-400"
            >
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="online">Online</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-stone-700">Notes (optional)</label>
            <input
              type="text"
              value={payNotes}
              onChange={(e) => setPayNotes(e.target.value)}
              placeholder="e.g. Cash paid at reception"
              className="w-full h-10 px-3 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-sage-400"
            />
          </div>
          <div className="flex gap-3 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => setRecordPaymentOpen(false)}>
              Cancel
            </Button>
            <Button className="flex-1" loading={payLoading} onClick={handleRecordPayment} disabled={!payAmount}>
              <CheckCircle2 className="h-4 w-4" />
              Record
            </Button>
          </div>
        </div>
      </Modal>

      {/* Renew Package */}
      <Modal
        open={renewOpen}
        onOpenChange={setRenewOpen}
        title="Renew Package"
        description={activePackage ? `Renewing: ${activePackage.package.name}` : ""}
        size="sm"
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-stone-700">New Start Date</label>
            <input
              type="date"
              value={renewStartDate}
              onChange={(e) => setRenewStartDate(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-sage-400"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-stone-700">Amount Paid Now (PKR, optional)</label>
            <input
              type="number"
              value={renewAmountPaid}
              onChange={(e) => setRenewAmountPaid(e.target.value)}
              min={0}
              placeholder="0 = mark as unpaid"
              className="w-full h-10 px-3 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-sage-400"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-stone-700">Payment Method</label>
            <select
              value={renewMethod}
              onChange={(e) => setRenewMethod(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-sage-400"
            >
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="online">Online</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="flex gap-3 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => setRenewOpen(false)}>
              Cancel
            </Button>
            <Button className="flex-1" loading={renewLoading} onClick={handleRenew}>
              <RefreshCw className="h-4 w-4" />
              Renew
            </Button>
          </div>
        </div>
      </Modal>

      {/* Guest pass confirm */}
      <ConfirmDialog
        open={guestPassConfirm}
        onOpenChange={setGuestPassConfirm}
        title="Mark Guest Pass Used"
        description={`This will reduce ${client.fullName}'s guest pass balance by 1. Remaining: ${activePackage?.guestPassesRemaining ?? 0}`}
        confirmLabel="Yes, Mark Used"
        onConfirm={() => handlePerk("use_guest_pass")}
        loading={perkLoading === "guest"}
      />

      {/* Drink confirm */}
      <ConfirmDialog
        open={drinkConfirm}
        onOpenChange={setDrinkConfirm}
        title="Mark Wellness Drink Used"
        description={`This will reduce ${client.fullName}'s wellness drink balance by 1. Remaining: ${activePackage?.drinksRemaining ?? 0}`}
        confirmLabel="Yes, Mark Used"
        onConfirm={() => handlePerk("use_drink")}
        loading={perkLoading === "drink"}
      />
    </div>
  );
}

// Missing import fix
function Gift(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <polyline points="20 12 20 22 4 22 4 12" />
      <rect x="2" y="7" width="20" height="5" />
      <line x1="12" y1="22" x2="12" y2="7" />
      <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
      <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
    </svg>
  );
}

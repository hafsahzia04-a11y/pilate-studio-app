"use client";

import { useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import {
  Search, Filter, UserPlus, Eye, Edit2, RefreshCw,
  CreditCard, Coffee, Users, MoreHorizontal, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Card } from "@/components/ui/card";
import {
  cn, formatDate, formatCurrency, daysUntil,
  computeEffectivePaymentStatus, paymentStatusLabel
} from "@/lib/utils";
import type { ClientWithPackage } from "@/types";

interface Props {
  clients: ClientWithPackage[];
  isStaff?: boolean;
}

type FilterStatus =
  | "all"
  | "active"
  | "no_package"
  | "overdue"
  | "expiring"
  | "partial"
  | "unpaid"
  | "founding"
  | "guest_pass"
  | "drinks";

// ─── Status helpers ────────────────────────────────────────────────────────────

function effectiveStatus(client: ClientWithPackage) {
  const cp = client.activePackage;
  if (!cp) return "no_package";
  return computeEffectivePaymentStatus(cp.paymentStatus, (cp as never as { paymentDueDate?: string }).paymentDueDate ?? null);
}

function rowBg(client: ClientWithPackage): string {
  const status = effectiveStatus(client);
  if (status === "overdue") return "bg-red-50 hover:bg-red-50/80";
  const cp = client.activePackage;
  if (!cp) return "hover:bg-cream-50";
  const daysLeft = daysUntil(cp.expiryDate);
  if (daysLeft <= 7 && daysLeft >= 0) return "bg-amber-50/50 hover:bg-amber-50";
  if (status === "partial" || status === "unpaid") return "bg-amber-50/30 hover:bg-amber-50";
  return "hover:bg-cream-50";
}

function paymentBadgeVariant(status: string): "sage" | "danger" | "warning" | "default" {
  if (status === "paid") return "sage";
  if (status === "overdue") return "danger";
  if (status === "partial") return "warning";
  if (status === "unpaid") return "default";
  return "default";
}

// ─── Quick action modal for recording payment inline ─────────────────────────

interface QuickPayModalProps {
  client: ClientWithPackage;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function QuickPayModal({ client, open, onClose, onSuccess }: QuickPayModalProps) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [loading, setLoading] = useState(false);

  const cp = client.activePackage as never as { id: string; amountDue: number; amountPaid: number } | null;
  const outstanding = cp ? cp.amountDue - cp.amountPaid : 0;

  async function submit() {
    if (!cp || !amount) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/client-packages/${cp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "record_payment", amount: Number(amount), paymentMethod: method }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      toast.success("Payment recorded");
      onSuccess();
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onClose}
      title={`Record Payment — ${client.fullName}`}
      description={cp ? `Outstanding: ${formatCurrency(outstanding)}` : "No active package"}
      size="sm"
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-stone-700">Amount (PKR)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={String(outstanding)}
            className="w-full h-10 px-3 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-sage-400"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-stone-700">Method</label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="w-full h-10 px-3 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-sage-400"
          >
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="online">Online</option>
          </select>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" onClick={submit} loading={loading} disabled={!amount}>
            <CreditCard className="h-4 w-4" />
            Record
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Main table component ─────────────────────────────────────────────────────

export function ClientsTable({ clients }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [quickPayClient, setQuickPayClient] = useState<ClientWithPackage | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const filtered = clients.filter((c) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      c.fullName.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.phone ?? "").includes(q);

    if (!matchesSearch) return false;

    const effStatus = effectiveStatus(c);
    const cp = c.activePackage;

    if (filter === "all") return true;
    if (filter === "active") return !!cp && cp.status === "active";
    if (filter === "no_package") return !cp;
    if (filter === "overdue") return effStatus === "overdue";
    if (filter === "expiring") {
      if (!cp) return false;
      const days = daysUntil(cp.expiryDate);
      return days <= 7 && days >= 0;
    }
    if (filter === "partial") return effStatus === "partial";
    if (filter === "unpaid") return effStatus === "unpaid";
    if (filter === "founding") return (c.clientProfile?.tags ?? []).includes("founding_member");
    if (filter === "guest_pass") return (cp?.guestPassesRemaining ?? 0) > 0;
    if (filter === "drinks") return (cp?.drinksRemaining ?? 0) > 0;

    return true;
  });

  const filterOptions: { label: string; value: FilterStatus; dot?: string }[] = [
    { label: "All", value: "all" },
    { label: "Active", value: "active" },
    { label: "Overdue", value: "overdue", dot: "bg-red-400" },
    { label: "Expiring Soon", value: "expiring", dot: "bg-amber-400" },
    { label: "Partial", value: "partial", dot: "bg-amber-300" },
    { label: "Unpaid", value: "unpaid" },
    { label: "No Package", value: "no_package" },
    { label: "Founding", value: "founding" },
    { label: "Guest Pass", value: "guest_pass" },
    { label: "Drinks", value: "drinks" },
  ];

  // Counts for badges
  const overdueCount = clients.filter((c) => effectiveStatus(c) === "overdue").length;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-stone-900">Clients</h1>
          <p className="text-sm text-stone-500">
            {clients.length} total members
            {overdueCount > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 text-red-600 font-medium">
                · {overdueCount} overdue
              </span>
            )}
          </p>
        </div>
        <Link href="/founder/clients/new">
          <Button className="flex-shrink-0">
            <UserPlus className="h-4 w-4" />
            Register Client
          </Button>
        </Link>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
          <input
            type="search"
            placeholder="Search by name, email or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-4 rounded-xl border border-stone-200 bg-white text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:border-sage-400 focus:ring-2 focus:ring-sage-100"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
          <Filter className="h-4 w-4 text-stone-400 flex-shrink-0" />
          {filterOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5",
                filter === opt.value
                  ? "bg-sage-500 text-white"
                  : "bg-white border border-stone-200 text-stone-600 hover:bg-cream-100"
              )}
            >
              {opt.dot && (
                <span className={cn("w-1.5 h-1.5 rounded-full", opt.dot)} />
              )}
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      {(search || filter !== "all") && (
        <p className="text-xs text-stone-500">
          Showing {filtered.length} of {clients.length} clients
        </p>
      )}

      {/* Table / Card list */}
      {filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-stone-400">No clients match your search.</p>
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block">
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-stone-100 bg-cream-50">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Name</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Contact</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Package</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Credits</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Expiry</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Payment</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Perks</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {filtered.map((client) => {
                      const effStatus = effectiveStatus(client);
                      const cp = client.activePackage;
                      const daysLeft = cp ? daysUntil(cp.expiryDate) : null;

                      return (
                        <tr key={client.id} className={cn("transition-colors", rowBg(client))}>
                          {/* Name */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-sage-100 text-sage-700 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                                {client.fullName.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase()}
                              </div>
                              <div>
                                <p className="font-medium text-stone-800">{client.fullName}</p>
                                {effStatus === "overdue" && (
                                  <p className="text-xs text-red-600 font-medium">⚠ Overdue</p>
                                )}
                                {effStatus !== "overdue" && daysLeft !== null && daysLeft <= 7 && daysLeft >= 0 && (
                                  <p className="text-xs text-amber-600">Expires in {daysLeft}d</p>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Contact */}
                          <td className="px-4 py-3 text-stone-600">
                            <p className="truncate max-w-[160px] text-xs">{client.email}</p>
                            {client.phone && <p className="text-xs text-stone-400">{client.phone}</p>}
                          </td>

                          {/* Package */}
                          <td className="px-4 py-3">
                            {cp ? (
                              <div>
                                <p className="font-medium text-stone-800 truncate max-w-[140px] text-xs">
                                  {cp.package.name}
                                </p>
                                <Badge
                                  variant={cp.package.type === "membership" ? "sage" : cp.package.type === "founding" ? "founding" : "default"}
                                  className="mt-0.5"
                                >
                                  {cp.package.type}
                                </Badge>
                              </div>
                            ) : (
                              <span className="text-stone-400 text-xs">No package</span>
                            )}
                          </td>

                          {/* Credits */}
                          <td className="px-4 py-3">
                            {cp ? (
                              <span
                                className={cn(
                                  "font-semibold",
                                  cp.remainingCredits === 0
                                    ? "text-red-500"
                                    : cp.remainingCredits <= 2
                                    ? "text-amber-600"
                                    : "text-sage-700"
                                )}
                              >
                                {cp.remainingCredits}
                                <span className="text-stone-400 font-normal text-xs"> / {cp.totalCredits}</span>
                              </span>
                            ) : (
                              <span className="text-stone-400">—</span>
                            )}
                          </td>

                          {/* Expiry */}
                          <td className="px-4 py-3">
                            {cp ? (
                              <span className={cn(
                                "text-xs",
                                daysLeft !== null && daysLeft <= 7 ? "text-amber-600 font-medium" : "text-stone-600"
                              )}>
                                {formatDate(cp.expiryDate)}
                              </span>
                            ) : (
                              <span className="text-stone-400 text-xs">—</span>
                            )}
                          </td>

                          {/* Payment */}
                          <td className="px-4 py-3">
                            {cp ? (
                              <Badge variant={paymentBadgeVariant(effStatus)}>
                                {paymentStatusLabel(effStatus)}
                              </Badge>
                            ) : (
                              <span className="text-stone-400 text-xs">—</span>
                            )}
                          </td>

                          {/* Perks */}
                          <td className="px-4 py-3">
                            <div className="flex gap-1.5">
                              {(cp?.guestPassesRemaining ?? 0) > 0 && (
                                <span className="flex items-center gap-0.5 text-xs text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-md">
                                  <Users className="h-3 w-3" />
                                  {cp!.guestPassesRemaining}
                                </span>
                              )}
                              {(cp?.drinksRemaining ?? 0) > 0 && (
                                <span className="flex items-center gap-0.5 text-xs text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                                  <Coffee className="h-3 w-3" />
                                  {cp!.drinksRemaining}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <Link href={`/founder/clients/${client.id}`}>
                                <Button variant="ghost" size="icon-sm" title="View profile">
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                              </Link>
                              {/* Quick action dropdown */}
                              <div className="relative">
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  title="Quick actions"
                                  onClick={() => setOpenMenuId(openMenuId === client.id ? null : client.id)}
                                >
                                  <MoreHorizontal className="h-3.5 w-3.5" />
                                </Button>
                                {openMenuId === client.id && (
                                  <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-stone-200 rounded-xl shadow-lg z-10">
                                    <button
                                      className="w-full text-left px-3 py-2 text-xs text-stone-700 hover:bg-cream-50 flex items-center gap-2 rounded-t-xl"
                                      onClick={() => { setOpenMenuId(null); router.push(`/founder/clients/${client.id}`); }}
                                    >
                                      <Eye className="h-3.5 w-3.5" />View Profile
                                    </button>
                                    <button
                                      className="w-full text-left px-3 py-2 text-xs text-stone-700 hover:bg-cream-50 flex items-center gap-2"
                                      onClick={() => { setOpenMenuId(null); router.push(`/founder/clients/${client.id}/edit`); }}
                                    >
                                      <Edit2 className="h-3.5 w-3.5" />Edit Profile
                                    </button>
                                    {cp && (
                                      <button
                                        className="w-full text-left px-3 py-2 text-xs text-stone-700 hover:bg-cream-50 flex items-center gap-2"
                                        onClick={() => { setOpenMenuId(null); setQuickPayClient(client); }}
                                      >
                                        <CreditCard className="h-3.5 w-3.5" />Record Payment
                                      </button>
                                    )}
                                    <button
                                      className="w-full text-left px-3 py-2 text-xs text-stone-700 hover:bg-cream-50 flex items-center gap-2 rounded-b-xl"
                                      onClick={() => { setOpenMenuId(null); router.push(`/founder/clients/${client.id}?tab=renew`); }}
                                    >
                                      <RefreshCw className="h-3.5 w-3.5" />Renew Package
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((client) => {
              const effStatus = effectiveStatus(client);
              const cp = client.activePackage;
              const daysLeft = cp ? daysUntil(cp.expiryDate) : null;

              return (
                <Card
                  key={client.id}
                  className={cn(
                    "p-4",
                    effStatus === "overdue" ? "border-l-4 border-l-red-400" :
                    daysLeft !== null && daysLeft <= 7 ? "border-l-4 border-l-amber-400" :
                    effStatus === "paid" && cp ? "border-l-4 border-l-sage-400" : ""
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-sage-100 text-sage-700 flex items-center justify-center text-sm font-semibold flex-shrink-0">
                        {client.fullName.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-stone-900 truncate">{client.fullName}</p>
                        <p className="text-xs text-stone-500">{client.phone ?? client.email}</p>
                        {effStatus === "overdue" && (
                          <p className="text-xs text-red-600 font-medium">⚠ Payment overdue</p>
                        )}
                      </div>
                    </div>
                    <Link href={`/founder/clients/${client.id}`}>
                      <Button variant="outline" size="sm">
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </div>

                  {cp && (
                    <div className="mt-3 pt-3 border-t border-stone-100 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-stone-600 font-medium">{cp.package.name}</span>
                        <Badge variant={paymentBadgeVariant(effStatus)}>
                          {paymentStatusLabel(effStatus)}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-xs text-stone-500">
                        <span>{cp.remainingCredits}/{cp.totalCredits} credits</span>
                        <span className={cn(daysLeft !== null && daysLeft <= 7 ? "text-amber-600 font-medium" : "")}>
                          Expires {formatDate(cp.expiryDate)}
                        </span>
                      </div>
                      {/* Perks row */}
                      <div className="flex gap-2">
                        {(cp.guestPassesRemaining ?? 0) > 0 && (
                          <span className="flex items-center gap-0.5 text-xs text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-md">
                            <Users className="h-3 w-3" />{cp.guestPassesRemaining} passes
                          </span>
                        )}
                        {(cp.drinksRemaining ?? 0) > 0 && (
                          <span className="flex items-center gap-0.5 text-xs text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                            <Coffee className="h-3 w-3" />{cp.drinksRemaining} drinks
                          </span>
                        )}
                      </div>
                      {/* Quick pay on mobile */}
                      {effStatus !== "paid" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full mt-1 text-xs"
                          onClick={() => setQuickPayClient(client)}
                        >
                          <CreditCard className="h-3 w-3" />
                          Record Payment
                        </Button>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* Quick pay modal */}
      {quickPayClient && (
        <QuickPayModal
          client={quickPayClient}
          open={!!quickPayClient}
          onClose={() => setQuickPayClient(null)}
          onSuccess={() => router.refresh()}
        />
      )}

      {/* Close dropdown on outside click */}
      {openMenuId && (
        <div
          className="fixed inset-0 z-[5]"
          onClick={() => setOpenMenuId(null)}
        />
      )}
    </div>
  );
}

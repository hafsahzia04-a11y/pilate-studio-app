"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import {
  DollarSign,
  AlertTriangle,
  Clock,
  Download,
  Plus,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Modal } from "@/components/ui/modal";
import { cn, formatCurrency, formatDate, paymentStatusLabel } from "@/lib/utils";

interface Payment {
  id: string;
  clientName: string;
  clientEmail: string;
  packageName: string;
  amount: number;
  netAmount: number;
  status: string;
  paymentMethod: string;
  dueDate: string | null;
  paidAt: string | null;
  createdAt: string;
  referenceNumber: string | null;
  notes: string | null;
}

interface OverduePackage {
  id: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string | null;
  packageName: string;
  amountDue: number;
  amountPaid: number;
  outstanding: number;
  dueDate: string | null;
}

interface ExpiringPackage {
  id: string;
  clientName: string;
  clientEmail: string;
  packageName: string;
  expiryDate: string;
  remainingCredits: number;
}

interface RecordPaymentForm {
  clientPackageId: string;
  amount: number;
  paymentMethod: string;
  referenceNumber: string;
  notes: string;
}

interface Props {
  payments: Payment[];
  overduePackages: OverduePackage[];
  expiringPackages: ExpiringPackage[];
  totalCollected: number;
  totalOutstanding: number;
  overdueCount: number;
}

type Tab = "all" | "overdue" | "expiring";

function paymentBadge(status: string): "sage" | "danger" | "warning" | "default" | "blue" {
  const map: Record<string, "sage" | "danger" | "warning" | "default" | "blue"> = {
    paid: "sage",
    overdue: "danger",
    partial: "warning",
    unpaid: "default",
    refunded: "blue",
  };
  return map[status] ?? "default";
}

export function PaymentsManager({
  payments,
  overduePackages,
  expiringPackages,
  totalCollected,
  totalOutstanding,
  overdueCount,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("all");
  const [recordOpen, setRecordOpen] = useState(false);
  const [selectedOverdue, setSelectedOverdue] = useState<OverduePackage | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RecordPaymentForm>({
    defaultValues: { paymentMethod: "cash", amount: 0 },
  });

  async function onRecordPayment(values: RecordPaymentForm) {
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to record payment");
      toast.success("Payment recorded successfully");
      setRecordOpen(false);
      setSelectedOverdue(null);
      reset();
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  function openRecordForOverdue(cp: OverduePackage) {
    setSelectedOverdue(cp);
    setValue("clientPackageId", cp.id);
    setValue("amount", cp.outstanding);
    setRecordOpen(true);
  }

  const tabs: { label: string; value: Tab; count?: number }[] = [
    { label: "All Payments", value: "all", count: payments.length },
    { label: "Overdue", value: "overdue", count: overduePackages.length },
    { label: "Expiring Soon", value: "expiring", count: expiringPackages.length },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-stone-900">Payments</h1>
          <p className="text-sm text-stone-500">Track collections and overdue accounts</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button onClick={() => { setSelectedOverdue(null); reset(); setRecordOpen(true); }}>
            <Plus className="h-4 w-4" />
            Record Payment
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Collected This Month"
          value={formatCurrency(totalCollected)}
          icon={<DollarSign className="h-5 w-5" />}
          color="sage"
        />
        <StatCard
          title="Outstanding Balance"
          value={formatCurrency(totalOutstanding)}
          icon={<AlertTriangle className="h-5 w-5" />}
          color={totalOutstanding > 0 ? "red" : "stone"}
        />
        <StatCard
          title="Overdue Accounts"
          value={overdueCount}
          icon={<Clock className="h-5 w-5" />}
          color={overdueCount > 0 ? "amber" : "stone"}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-stone-100 p-1 rounded-xl w-fit">
        {tabs.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap",
              tab === t.value
                ? "bg-white shadow-card text-stone-900"
                : "text-stone-500 hover:text-stone-700"
            )}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span
                className={cn(
                  "ml-1.5 text-xs px-1.5 py-0.5 rounded-full",
                  tab === t.value
                    ? "bg-sage-100 text-sage-700"
                    : "bg-stone-200 text-stone-600"
                )}
              >
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* All payments tab */}
      {tab === "all" && (
        <Card className="overflow-hidden">
          {payments.length === 0 ? (
            <div className="p-12 text-center">
              <CheckCircle className="h-8 w-8 text-stone-300 mx-auto mb-2" />
              <p className="text-stone-400 text-sm">No payments recorded yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-100 bg-cream-50">
                    {["Client", "Package", "Amount", "Method", "Status", "Due Date", "Paid At"].map(
                      (h) => (
                        <th
                          key={h}
                          className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide whitespace-nowrap"
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {payments.map((p) => (
                    <tr key={p.id} className="hover:bg-cream-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-stone-800">{p.clientName}</p>
                        <p className="text-xs text-stone-400">{p.clientEmail}</p>
                      </td>
                      <td className="px-4 py-3 text-stone-600 text-xs">{p.packageName}</td>
                      <td className="px-4 py-3 font-semibold text-stone-900">
                        {formatCurrency(p.amount)}
                      </td>
                      <td className="px-4 py-3 text-stone-500 capitalize text-xs">
                        {p.paymentMethod.replace("_", " ")}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={paymentBadge(p.status)}>
                          {paymentStatusLabel(p.status)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-stone-500 text-xs">
                        {p.dueDate ? formatDate(p.dueDate) : "—"}
                      </td>
                      <td className="px-4 py-3 text-stone-500 text-xs">
                        {p.paidAt ? formatDate(p.paidAt) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Overdue tab */}
      {tab === "overdue" && (
        <div className="space-y-3">
          {overduePackages.length === 0 ? (
            <Card className="p-12 text-center">
              <CheckCircle className="h-8 w-8 text-sage-400 mx-auto mb-2" />
              <p className="text-stone-500 text-sm">No overdue payments. Great news!</p>
            </Card>
          ) : (
            overduePackages.map((cp) => (
              <Card key={cp.id} className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-stone-900">{cp.clientName}</p>
                      <Badge variant="danger">Overdue</Badge>
                    </div>
                    <p className="text-sm text-stone-500 mt-0.5">{cp.packageName}</p>
                    {cp.dueDate && (
                      <p className="text-xs text-red-500 mt-0.5">
                        Due: {formatDate(cp.dueDate)}
                      </p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-lg font-bold text-red-600">
                      {formatCurrency(cp.outstanding)}
                    </p>
                    <p className="text-xs text-stone-400">outstanding</p>
                  </div>
                  <Button size="sm" onClick={() => openRecordForOverdue(cp)}>
                    Record
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Expiring tab */}
      {tab === "expiring" && (
        <div className="space-y-3">
          {expiringPackages.length === 0 ? (
            <Card className="p-12 text-center">
              <p className="text-stone-400 text-sm">No packages expiring in the next 7 days.</p>
            </Card>
          ) : (
            expiringPackages.map((cp) => (
              <Card key={cp.id} className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-stone-900">{cp.clientName}</p>
                    <p className="text-sm text-stone-500">{cp.packageName}</p>
                    <p className="text-xs text-amber-600 mt-0.5">
                      Expires: {formatDate(cp.expiryDate)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-stone-700">{cp.remainingCredits}</p>
                    <p className="text-xs text-stone-400">credits left</p>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Record Payment Modal */}
      <Modal
        open={recordOpen}
        onOpenChange={(open) => {
          setRecordOpen(open);
          if (!open) { reset(); setSelectedOverdue(null); }
        }}
        title="Record Payment"
        description={
          selectedOverdue
            ? `Recording payment for ${selectedOverdue.clientName}`
            : "Record a new payment"
        }
      >
        <form onSubmit={handleSubmit(onRecordPayment)} className="space-y-4">
          {!selectedOverdue && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-stone-700">
                Client Package ID
              </label>
              <input
                type="text"
                placeholder="Package ID"
                {...register("clientPackageId", { required: "Required" })}
                className="w-full h-10 px-3 rounded-xl border border-stone-200 bg-white text-sm focus:outline-none focus:border-sage-400 focus:ring-2 focus:ring-sage-100"
              />
              {errors.clientPackageId && (
                <p className="text-xs text-red-500">{errors.clientPackageId.message}</p>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-stone-700">Amount (AED)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              {...register("amount", { required: "Amount is required", valueAsNumber: true, min: 0 })}
              className="w-full h-10 px-3 rounded-xl border border-stone-200 bg-white text-sm focus:outline-none focus:border-sage-400 focus:ring-2 focus:ring-sage-100"
            />
            {errors.amount && (
              <p className="text-xs text-red-500">{errors.amount.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-stone-700">Payment Method</label>
            <select
              {...register("paymentMethod", { required: true })}
              className="w-full h-10 px-3 rounded-xl border border-stone-200 bg-white text-sm focus:outline-none focus:border-sage-400"
            >
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="online">Online</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-stone-700">
              Reference Number (optional)
            </label>
            <input
              type="text"
              placeholder="e.g. TXN123456"
              {...register("referenceNumber")}
              className="w-full h-10 px-3 rounded-xl border border-stone-200 bg-white text-sm focus:outline-none focus:border-sage-400 focus:ring-2 focus:ring-sage-100"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-stone-700">Notes (optional)</label>
            <textarea
              rows={2}
              placeholder="Any additional notes…"
              {...register("notes")}
              className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-white text-sm focus:outline-none focus:border-sage-400 focus:ring-2 focus:ring-sage-100 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => { setRecordOpen(false); reset(); setSelectedOverdue(null); }}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" loading={isSubmitting}>
              <CheckCircle className="h-4 w-4" />
              Record Payment
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

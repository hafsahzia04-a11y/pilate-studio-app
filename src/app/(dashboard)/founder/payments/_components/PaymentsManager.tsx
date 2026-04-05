"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { startOfMonth } from "date-fns";
import {
  DollarSign, AlertTriangle, Clock, Plus, CheckCircle, X,
  Calendar, Trash2, Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { cn, formatCurrency, formatDate, paymentStatusLabel } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Payment {
  id: string; clientName: string; clientEmail: string; packageName: string;
  amount: number; netAmount: number; status: string; paymentMethod: string;
  dueDate: string | null; paidAt: string | null; createdAt: string;
  referenceNumber: string | null; notes: string | null;
}

interface OverduePackage {
  id: string; clientId: string; clientName: string; clientEmail: string;
  clientPhone: string | null; packageName: string;
  amountDue: number; amountPaid: number; outstanding: number; dueDate: string | null;
}

interface ExpiringPackage {
  id: string; clientName: string; clientEmail: string;
  packageName: string; expiryDate: string; remainingCredits: number;
}

interface ClientWithPackages {
  id: string; fullName: string; email: string;
  packages: {
    id: string; packageName: string; packageType: string;
    amountDue: number; amountPaid: number; outstanding: number;
    paymentStatus: string; expiryDate: string;
  }[];
}

interface AvailablePackage {
  id: string; name: string; type: string;
  price: number; classCredits: number; validityDays: number;
}

interface Props {
  payments: Payment[];
  overduePackages: OverduePackage[];
  expiringPackages: ExpiringPackage[];
  dueTomorrowPackages: OverduePackage[];
  allClients: ClientWithPackages[];
  allPackages: AvailablePackage[];
  dropInPrice: number;
  totalCollected: number;       // server-computed — used as initial fallback only
  totalOutstanding: number;
  overdueCount: number;
  dueTomorrowCount: number;
}

type Tab = "all" | "overdue" | "due_tomorrow" | "expiring";

const inputCls = "w-full h-10 px-3 rounded-xl border border-stone-200 bg-white text-sm focus:outline-none focus:border-sage-400 focus:ring-2 focus:ring-sage-100";
const NEW_PKG_PREFIX = "new:";

function paymentBadge(status: string): "sage" | "danger" | "warning" | "default" | "blue" {
  const map: Record<string, "sage" | "danger" | "warning" | "default" | "blue"> = {
    paid: "sage", overdue: "danger", partial: "warning", unpaid: "default", refunded: "blue",
  };
  return map[status] ?? "default";
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PaymentsManager({
  payments: initialPayments,
  overduePackages, expiringPackages, dueTomorrowPackages,
  allClients, allPackages, dropInPrice,
  totalCollected: serverTotalCollected,
  totalOutstanding, overdueCount, dueTomorrowCount,
}: Props) {
  const router = useRouter();

  // ── Local mutable state (source of truth for totals) ──────────────────────
  const [localPayments, setLocalPayments] = useState(initialPayments);
  const [tab, setTab] = useState<Tab>("all");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── Derived totals — always recomputed from current localPayments ─────────
  const monthStart = startOfMonth(new Date());
  const computedCollected = useMemo(
    () =>
      localPayments
        .filter(
          (p) =>
            p.status === "paid" &&
            p.paidAt &&
            new Date(p.paidAt) >= monthStart
        )
        .reduce((sum, p) => sum + p.amount, 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [localPayments]
  );

  // ── Record payment modal ───────────────────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [packageOption, setPackageOption] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");

  // ── Edit payment modal ────────────────────────────────────────────────────
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editMethod, setEditMethod] = useState("cash");
  const [editNotes, setEditNotes] = useState("");
  const [editPaidAt, setEditPaidAt] = useState("");

  const selectedClient = allClients.find((c) => c.id === clientId) ?? null;

  function resetForm() {
    setClientId(""); setPackageOption(""); setAmount("");
    setPaymentMethod("cash"); setReferenceNumber(""); setNotes("");
  }

  function openForOverdue(cp: OverduePackage) {
    resetForm();
    setClientId(cp.clientId);
    setPackageOption(cp.id);
    setAmount(String(cp.outstanding));
    setModalOpen(true);
  }

  function onClientChange(id: string) {
    setClientId(id); setPackageOption(""); setAmount("");
  }

  function onPackageChange(option: string) {
    setPackageOption(option);
    if (option.startsWith(NEW_PKG_PREFIX)) {
      const pkgId = option.slice(NEW_PKG_PREFIX.length);
      const pkg = allPackages.find((p) => p.id === pkgId);
      if (pkg) setAmount(String(pkg.price));
    } else if (option) {
      const pkg = selectedClient?.packages.find((p) => p.id === option);
      if (pkg) setAmount(String(pkg.outstanding > 0 ? pkg.outstanding : pkg.amountDue));
    } else {
      setAmount("");
    }
  }

  // ── Delete payment ─────────────────────────────────────────────────────────
  async function deletePayment(id: string) {
    if (!confirm("Delete this payment? It will be marked as refunded and the amount will be reversed from the client's package balance.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/payments/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Failed to delete"); return; }
      setLocalPayments((prev) => prev.filter((p) => p.id !== id));
      toast.success("Payment deleted");
      router.refresh(); // re-runs server component to sync overdueCount, outstanding etc.
    } finally { setDeletingId(null); }
  }

  // ── Edit payment ───────────────────────────────────────────────────────────
  function openEdit(p: Payment) {
    setEditingPayment(p);
    setEditAmount(String(p.amount));
    setEditMethod(p.paymentMethod);
    setEditNotes(p.notes ?? "");
    setEditPaidAt(p.paidAt ? p.paidAt.slice(0, 10) : "");
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingPayment) return;
    const amtNum = Number(editAmount);
    if (isNaN(amtNum) || amtNum <= 0) { toast.error("Enter a valid amount"); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/payments/${editingPayment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amtNum,
          paymentMethod: editMethod,
          notes: editNotes.trim() || null,
          paidAt: editPaidAt ? new Date(editPaidAt).toISOString() : editingPayment.paidAt,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Failed to update"); return; }
      setLocalPayments((prev) =>
        prev.map((p) =>
          p.id === editingPayment.id
            ? { ...p, amount: amtNum, paymentMethod: editMethod, notes: editNotes.trim() || null, paidAt: editPaidAt ? new Date(editPaidAt).toISOString() : p.paidAt }
            : p
        )
      );
      toast.success("Payment updated");
      setEditingPayment(null);
      router.refresh();
    } finally { setSaving(false); }
  }

  // ── Record payment ─────────────────────────────────────────────────────────
  async function submitPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId) { toast.error("Select a client"); return; }
    if (!packageOption) { toast.error("Select a package"); return; }
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) { toast.error("Enter a valid amount"); return; }
    setSaving(true);
    try {
      if (packageOption.startsWith(NEW_PKG_PREFIX)) {
        const pkgId = packageOption.slice(NEW_PKG_PREFIX.length);
        const res = await fetch(`/api/packages/${pkgId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientId, amountPaid: Number(amount), paymentMethod, notes: notes.trim() || null }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to assign package");
        toast.success("Package assigned and payment recorded");
      } else {
        const res = await fetch("/api/payments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientId, amount: Number(amount), paymentMethod,
            referenceNumber: referenceNumber.trim() || null,
            notes: notes.trim() || null,
            clientPackageId: packageOption,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed");
        // Add new payment to local state immediately
        const client = allClients.find((c) => c.id === clientId);
        const pkg = client?.packages.find((p) => p.id === packageOption);
        const newPayment: Payment = {
          id: data.data?.id ?? String(Date.now()),
          clientName: client?.fullName ?? "",
          clientEmail: client?.email ?? "",
          packageName: pkg?.packageName ?? "",
          amount: Number(amount),
          netAmount: Number(amount),
          status: "paid",
          paymentMethod,
          dueDate: null,
          paidAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          referenceNumber: referenceNumber.trim() || null,
          notes: notes.trim() || null,
        };
        setLocalPayments((prev) => [newPayment, ...prev]);
        toast.success("Payment recorded");
      }
      setModalOpen(false); resetForm(); router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally { setSaving(false); }
  }

  // ── Tabs config ────────────────────────────────────────────────────────────
  const tabs: { label: string; value: Tab; count?: number }[] = [
    { label: "All Payments", value: "all", count: localPayments.filter(p => p.status !== "refunded").length },
    { label: "Overdue", value: "overdue", count: overduePackages.length },
    { label: "Due Tomorrow", value: "due_tomorrow", count: dueTomorrowPackages.length },
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
        <Button onClick={() => { resetForm(); setModalOpen(true); }}>
          <Plus className="h-4 w-4" /> Record Payment
        </Button>
      </div>

      {/* Alert banner */}
      {(overdueCount > 0 || dueTomorrowCount > 0) && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-red-700 space-y-0.5">
            {overdueCount > 0 && <p><span className="font-semibold">{overdueCount} client{overdueCount !== 1 ? "s" : ""}</span> with overdue payments — collect immediately.</p>}
            {dueTomorrowCount > 0 && <p><span className="font-semibold">{dueTomorrowCount} client{dueTomorrowCount !== 1 ? "s" : ""}</span> with payment due tomorrow.</p>}
          </div>
        </div>
      )}

      {/* Stats — computedCollected is derived from localPayments so always accurate */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Collected This Month" value={formatCurrency(computedCollected)} icon={<DollarSign className="h-5 w-5" />} color="sage" />
        <StatCard title="Outstanding Balance" value={formatCurrency(totalOutstanding)} icon={<AlertTriangle className="h-5 w-5" />} color={totalOutstanding > 0 ? "red" : "stone"} />
        <StatCard title="Overdue Accounts" value={overdueCount} icon={<Clock className="h-5 w-5" />} color={overdueCount > 0 ? "amber" : "stone"} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-stone-100 p-1 rounded-xl w-fit overflow-x-auto">
        {tabs.map((t) => (
          <button key={t.value} onClick={() => setTab(t.value)}
            className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap",
              tab === t.value ? "bg-white shadow-card text-stone-900" : "text-stone-500 hover:text-stone-700")}>
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className={cn("ml-1.5 text-xs px-1.5 py-0.5 rounded-full",
                tab === t.value ? "bg-sage-100 text-sage-700" : "bg-stone-200 text-stone-600")}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── All payments ─────────────────────────────────────────────────────── */}
      {tab === "all" && (
        <Card className="overflow-hidden">
          {localPayments.filter(p => p.status !== "refunded").length === 0 ? (
            <div className="p-12 text-center">
              <CheckCircle className="h-8 w-8 text-stone-300 mx-auto mb-2" />
              <p className="text-stone-400 text-sm">No payments recorded yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-100 bg-cream-50">
                    {["Client", "Package", "Amount (PKR)", "Method", "Status", "Due Date", "Paid At", ""].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {localPayments.filter(p => p.status !== "refunded").map((p) => (
                    <tr key={p.id} className={cn("transition-colors",
                      p.status === "overdue" ? "bg-red-50 hover:bg-red-100" : "hover:bg-cream-50")}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-stone-800">{p.clientName}</p>
                        <p className="text-xs text-stone-400">{p.clientEmail}</p>
                      </td>
                      <td className="px-4 py-3 text-stone-600 text-xs">{p.packageName}</td>
                      <td className="px-4 py-3 font-semibold text-stone-900">{formatCurrency(p.amount)}</td>
                      <td className="px-4 py-3 text-stone-500 capitalize text-xs">{p.paymentMethod.replace("_", " ")}</td>
                      <td className="px-4 py-3"><Badge variant={paymentBadge(p.status)}>{paymentStatusLabel(p.status)}</Badge></td>
                      <td className={cn("px-4 py-3 text-xs", p.status === "overdue" ? "text-red-600 font-medium" : "text-stone-500")}>
                        {p.dueDate ? formatDate(p.dueDate) : "—"}
                      </td>
                      <td className="px-4 py-3 text-stone-500 text-xs">{p.paidAt ? formatDate(p.paidAt) : "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={() => openEdit(p)}
                            className="text-stone-300 hover:text-sage-600 transition-colors"
                            title="Edit payment"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => deletePayment(p.id)}
                            disabled={deletingId === p.id}
                            className="text-stone-300 hover:text-red-500 transition-colors disabled:opacity-50"
                            title="Delete payment"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* ── Overdue ───────────────────────────────────────────────────────────── */}
      {tab === "overdue" && (
        <div className="space-y-3">
          {overduePackages.length === 0 ? (
            <Card className="p-12 text-center">
              <CheckCircle className="h-8 w-8 text-sage-400 mx-auto mb-2" />
              <p className="text-stone-500 text-sm">No overdue payments.</p>
            </Card>
          ) : overduePackages.map((cp) => (
            <Card key={cp.id} className="p-4 border-red-200 bg-red-50">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-stone-900">{cp.clientName}</p>
                    <Badge variant="danger">Overdue</Badge>
                  </div>
                  <p className="text-sm text-stone-500 mt-0.5">{cp.packageName}</p>
                  {cp.dueDate && <p className="text-xs text-red-600 mt-0.5 font-medium">Was due: {formatDate(cp.dueDate)}</p>}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-lg font-bold text-red-600">{formatCurrency(cp.outstanding)}</p>
                  <p className="text-xs text-stone-400">outstanding</p>
                </div>
                <Button size="sm" onClick={() => openForOverdue(cp)}>Record</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ── Due Tomorrow ──────────────────────────────────────────────────────── */}
      {tab === "due_tomorrow" && (
        <div className="space-y-3">
          {dueTomorrowPackages.length === 0 ? (
            <Card className="p-12 text-center">
              <Calendar className="h-8 w-8 text-stone-300 mx-auto mb-2" />
              <p className="text-stone-400 text-sm">No payments due tomorrow.</p>
            </Card>
          ) : dueTomorrowPackages.map((cp) => (
            <Card key={cp.id} className="p-4 border-amber-200 bg-amber-50">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-stone-900">{cp.clientName}</p>
                    <Badge variant="warning">Due Tomorrow</Badge>
                  </div>
                  <p className="text-sm text-stone-500 mt-0.5">{cp.packageName}</p>
                  {cp.dueDate && <p className="text-xs text-amber-700 mt-0.5 font-medium">Due: {formatDate(cp.dueDate)}</p>}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-lg font-bold text-amber-700">{formatCurrency(cp.outstanding)}</p>
                  <p className="text-xs text-stone-400">outstanding</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => openForOverdue(cp)}>Record</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ── Expiring ──────────────────────────────────────────────────────────── */}
      {tab === "expiring" && (
        <div className="space-y-3">
          {expiringPackages.length === 0 ? (
            <Card className="p-12 text-center">
              <p className="text-stone-400 text-sm">No packages expiring in the next 7 days.</p>
            </Card>
          ) : expiringPackages.map((cp) => (
            <Card key={cp.id} className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-semibold text-stone-900">{cp.clientName}</p>
                  <p className="text-sm text-stone-500">{cp.packageName}</p>
                  <p className="text-xs text-amber-600 mt-0.5">Expires: {formatDate(cp.expiryDate)}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-stone-700">{cp.remainingCredits}</p>
                  <p className="text-xs text-stone-400">credits left</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ── Record Payment Modal ──────────────────────────────────────────────── */}
      {modalOpen && (
        <PaymentModal title="Record Payment" onClose={() => { setModalOpen(false); resetForm(); }} onSubmit={submitPayment} saving={saving}>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Client *</label>
            <select className={inputCls} value={clientId} onChange={(e) => onClientChange(e.target.value)} required>
              <option value="">— select client —</option>
              {allClients.map((c) => <option key={c.id} value={c.id}>{c.fullName}</option>)}
            </select>
          </div>

          {clientId && (
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Package *</label>
              <select className={inputCls} value={packageOption} onChange={(e) => onPackageChange(e.target.value)} required>
                <option value="">— select package —</option>
                {selectedClient && selectedClient.packages.length > 0 && (
                  <optgroup label="Existing Active Packages">
                    {selectedClient.packages.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.packageName}{p.outstanding > 0 ? ` — ${formatCurrency(p.outstanding)} due` : " — fully paid"}
                      </option>
                    ))}
                  </optgroup>
                )}
                {allPackages.length > 0 && (
                  <optgroup label="New Purchase (assign + record payment)">
                    {allPackages.map((p) => (
                      <option key={p.id} value={`${NEW_PKG_PREFIX}${p.id}`}>
                        {p.name} — {formatCurrency(p.price)} · {p.classCredits} classes · {p.validityDays}d
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
              {packageOption.startsWith(NEW_PKG_PREFIX) && (() => {
                const pkg = allPackages.find((p) => p.id === packageOption.slice(NEW_PKG_PREFIX.length));
                return pkg ? (
                  <p className="text-xs text-sage-700 mt-1 bg-sage-50 rounded-lg px-3 py-1.5">
                    New {pkg.name} will be assigned — {pkg.classCredits} classes, valid {pkg.validityDays} days.
                  </p>
                ) : null;
              })()}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Amount (PKR) *</label>
            <input type="number" step="0.01" min="0" className={inputCls} value={amount}
              onChange={(e) => setAmount(e.target.value)} placeholder="0" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Payment Method</label>
            <select className={inputCls} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="online">Online</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Reference <span className="text-stone-400">(optional)</span></label>
            <input type="text" placeholder="e.g. TXN123456" className={inputCls}
              value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Notes <span className="text-stone-400">(optional)</span></label>
            <textarea rows={2} placeholder="Any additional notes…"
              className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-white text-sm focus:outline-none focus:border-sage-400 focus:ring-2 focus:ring-sage-100 resize-none"
              value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </PaymentModal>
      )}

      {/* ── Edit Payment Modal ────────────────────────────────────────────────── */}
      {editingPayment && (
        <PaymentModal title={`Edit — ${editingPayment.clientName}`} onClose={() => setEditingPayment(null)} onSubmit={submitEdit} saving={saving} submitLabel="Save Changes">
          <div className="bg-stone-50 rounded-xl px-3 py-2 text-xs text-stone-500 space-y-0.5">
            <p><span className="font-medium">Package:</span> {editingPayment.packageName}</p>
            <p><span className="font-medium">Original amount:</span> {formatCurrency(editingPayment.amount)}</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Amount (PKR) *</label>
            <input type="number" step="0.01" min="0" className={inputCls} value={editAmount}
              onChange={(e) => setEditAmount(e.target.value)} required />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Payment Method</label>
            <select className={inputCls} value={editMethod} onChange={(e) => setEditMethod(e.target.value)}>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="online">Online</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Paid On</label>
            <input type="date" className={inputCls} value={editPaidAt}
              onChange={(e) => setEditPaidAt(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Notes</label>
            <textarea rows={2} className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-white text-sm focus:outline-none focus:border-sage-400 resize-none"
              value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
          </div>
        </PaymentModal>
      )}
    </div>
  );
}

// ─── Reusable modal shell ──────────────────────────────────────────────────────

function PaymentModal({
  title, onClose, onSubmit, saving, submitLabel = "Record Payment", children,
}: {
  title: string; onClose: () => void; onSubmit: (e: React.FormEvent) => void;
  saving: boolean; submitLabel?: string; children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
          <h2 className="text-base font-semibold text-stone-900">{title}</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={onSubmit} className="px-6 py-5 space-y-4">
          {children}
          <div className="flex gap-3 pt-2 border-t border-stone-100">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="flex-1" loading={saving}>{saving ? "Saving…" : submitLabel}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

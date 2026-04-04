"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Plus, Search, Users, Wallet, AlertCircle, CheckCircle2,
  Phone, Mail, ChevronRight, X,
} from "lucide-react";
import toast from "react-hot-toast";
import { format } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SalaryRecord {
  id: string;
  amountDue: number;
  amountPaid: number;
  paymentStatus: string;
  dueDate: string;
}

interface InstructorSummary {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  status: string;
  instructorProfile: {
    specializations: string[];
    payoutType: string;
    payoutRate: number;
    salary: number | null;
    salaryDueDay: number | null;
    commissionPercent: number | null;
    startDate: string | null;
    isAvailable: boolean;
  } | null;
  totalSessions: number;
  totalReferrals: number;
  currentSalaryRecord: SalaryRecord | null;
}

interface Props {
  instructors: InstructorSummary[];
  summary: {
    totalInstructors: number;
    activeInstructors: number;
    salariesDue: number;
    salariesOverdue: number;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const inputCls = "w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 outline-none focus:border-sage-400 focus:ring-2 focus:ring-sage-100";
const labelCls = "block text-xs font-medium text-stone-600 mb-1";

function salaryBadge(record: SalaryRecord | null) {
  if (!record) return null;
  const isOverdue = record.paymentStatus !== "paid" && new Date(record.dueDate) < new Date();
  if (isOverdue) return <Badge variant="danger">Overdue</Badge>;
  if (record.paymentStatus === "paid") return <Badge variant="sage">Paid</Badge>;
  if (record.paymentStatus === "partial") return <Badge variant="warning">Partial</Badge>;
  return <Badge variant="warning">Unpaid</Badge>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function InstructorsList({ instructors: initialInstructors, summary }: Props) {
  const router = useRouter();
  const [instructors, setInstructors] = useState(initialInstructors);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [addForm, setAddForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    specializations: "",
    payoutType: "per_class",
    payoutRate: "",
    salary: "",
    salaryDueDay: "",
    commissionPercent: "",
    startDate: "",
    notes: "",
  });

  function setF(field: string, value: string) {
    setAddForm((f) => ({ ...f, [field]: value }));
  }

  const filtered = instructors.filter((i) => {
    if (statusFilter !== "all" && i.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        i.fullName.toLowerCase().includes(q) ||
        i.email.toLowerCase().includes(q) ||
        (i.instructorProfile?.specializations ?? []).some((s) => s.toLowerCase().includes(q))
      );
    }
    return true;
  });

  async function submitAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!addForm.fullName.trim() || !addForm.email.trim()) {
      toast.error("Name and email are required");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/instructors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: addForm.fullName.trim(),
          email: addForm.email.trim(),
          phone: addForm.phone.trim() || null,
          specializations: addForm.specializations
            ? addForm.specializations.split(",").map((s) => s.trim()).filter(Boolean)
            : [],
          payoutType: addForm.payoutType,
          payoutRate: addForm.payoutRate ? Number(addForm.payoutRate) : 0,
          salary: addForm.salary ? Number(addForm.salary) : null,
          salaryDueDay: addForm.salaryDueDay ? Number(addForm.salaryDueDay) : null,
          commissionPercent: addForm.commissionPercent ? Number(addForm.commissionPercent) : null,
          startDate: addForm.startDate || null,
          notes: addForm.notes.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to add instructor");
        return;
      }

      toast.success(`${addForm.fullName} added as instructor`);
      setShowAddForm(false);
      setAddForm({ fullName: "", email: "", phone: "", specializations: "", payoutType: "per_class", payoutRate: "", salary: "", salaryDueDay: "", commissionPercent: "", startDate: "", notes: "" });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="Total Instructors" value={summary.totalInstructors} icon={<Users className="h-4 w-4" />} color="text-stone-600" />
        <SummaryCard label="Active" value={summary.activeInstructors} icon={<CheckCircle2 className="h-4 w-4" />} color="text-sage-600" />
        <SummaryCard label="Salaries Due" value={summary.salariesDue} icon={<Wallet className="h-4 w-4" />} color="text-amber-600" />
        <SummaryCard label="Overdue" value={summary.salariesOverdue} icon={<AlertCircle className="h-4 w-4" />} color="text-red-600" />
      </div>

      {/* Filters + Add */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400" />
            <input
              className="pl-9 pr-3 py-2 text-sm rounded-xl border border-stone-200 bg-white outline-none focus:border-sage-400 w-56"
              placeholder="Search instructors…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2">
                <X className="h-3.5 w-3.5 text-stone-400" />
              </button>
            )}
          </div>
          {["all", "active", "inactive"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-medium transition-all capitalize",
                statusFilter === s ? "bg-sage-500 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              )}
            >
              {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <Button size="sm" onClick={() => setShowAddForm(true)}>
          <Plus className="h-4 w-4" /> Add Instructor
        </Button>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-stone-400">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No instructors found</p>
          {!search && statusFilter === "all" && (
            <button onClick={() => setShowAddForm(true)} className="mt-2 text-xs text-sage-600 hover:underline">
              + Add the first instructor
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-stone-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-stone-500">Instructor</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-stone-500 hidden md:table-cell">Teaches</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-stone-500 hidden lg:table-cell">Pay</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-stone-500">Sessions</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-stone-500">This Month</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-stone-500">Status</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {filtered.map((instructor) => (
                <tr
                  key={instructor.id}
                  className="hover:bg-cream-50 cursor-pointer transition-colors"
                  onClick={() => router.push(`/founder/instructors/${instructor.id}`)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-sage-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-sage-700 text-xs font-semibold">
                          {instructor.fullName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-stone-900">{instructor.fullName}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-stone-400 flex items-center gap-1">
                            <Mail className="h-3 w-3" />{instructor.email}
                          </span>
                          {instructor.phone && (
                            <span className="text-xs text-stone-400 flex items-center gap-1">
                              <Phone className="h-3 w-3" />{instructor.phone}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {(instructor.instructorProfile?.specializations ?? []).slice(0, 3).map((s) => (
                        <span key={s} className="text-xs bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full">{s}</span>
                      ))}
                      {(instructor.instructorProfile?.specializations ?? []).length > 3 && (
                        <span className="text-xs text-stone-400">+{(instructor.instructorProfile?.specializations ?? []).length - 3}</span>
                      )}
                      {(instructor.instructorProfile?.specializations ?? []).length === 0 && (
                        <span className="text-xs text-stone-300">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <p className="text-xs text-stone-600">
                      {instructor.instructorProfile?.payoutType === "salary"
                        ? `PKR ${instructor.instructorProfile.salary?.toLocaleString() ?? "—"}/mo`
                        : instructor.instructorProfile?.payoutType === "per_class"
                        ? `PKR ${instructor.instructorProfile.payoutRate?.toLocaleString() ?? "—"}/class`
                        : "—"}
                    </p>
                    {instructor.instructorProfile?.commissionPercent != null && (
                      <p className="text-xs text-stone-400">{instructor.instructorProfile.commissionPercent}% commission</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-medium text-stone-700">{instructor.totalSessions}</span>
                    <p className="text-xs text-stone-400">{instructor.totalReferrals} referral{instructor.totalReferrals !== 1 ? "s" : ""}</p>
                  </td>
                  <td className="px-4 py-3">
                    {salaryBadge(instructor.currentSalaryRecord) ?? (
                      <span className="text-xs text-stone-300">No record</span>
                    )}
                    {instructor.currentSalaryRecord && (
                      <p className="text-xs text-stone-400 mt-0.5">
                        PKR {instructor.currentSalaryRecord.amountPaid.toLocaleString()} / {instructor.currentSalaryRecord.amountDue.toLocaleString()}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={instructor.status === "active" ? "sage" : "default"}>
                      {instructor.status}
                    </Badge>
                  </td>
                  <td className="pr-4">
                    <ChevronRight className="h-4 w-4 text-stone-300" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Add Instructor Modal ──────────────────────────────────────────────── */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
              <h2 className="text-base font-semibold text-stone-900">Add Instructor</h2>
              <button onClick={() => setShowAddForm(false)} className="text-stone-400 hover:text-stone-600 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={submitAdd} className="px-6 py-5 space-y-4">
              {/* Name + Email */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Full Name *</label>
                  <input className={inputCls} value={addForm.fullName} onChange={(e) => setF("fullName", e.target.value)} placeholder="Sara Ahmed" required />
                </div>
                <div>
                  <label className={labelCls}>Email *</label>
                  <input type="email" className={inputCls} value={addForm.email} onChange={(e) => setF("email", e.target.value)} placeholder="sara@studio.com" required />
                </div>
              </div>

              {/* Phone + Start Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Phone</label>
                  <input className={inputCls} value={addForm.phone} onChange={(e) => setF("phone", e.target.value)} placeholder="+92 300 000 0000" />
                </div>
                <div>
                  <label className={labelCls}>Start Date</label>
                  <input type="date" className={inputCls} value={addForm.startDate} onChange={(e) => setF("startDate", e.target.value)} />
                </div>
              </div>

              {/* What they teach */}
              <div>
                <label className={labelCls}>What They Teach <span className="text-stone-400">(comma-separated)</span></label>
                <input className={inputCls} value={addForm.specializations} onChange={(e) => setF("specializations", e.target.value)} placeholder="Pilates, Yoga, Reformer" />
              </div>

              {/* Pay structure */}
              <div className="rounded-xl border border-stone-200 p-4 space-y-3 bg-stone-50">
                <p className="text-xs font-semibold text-stone-600 uppercase tracking-wide">Pay Structure</p>
                <div>
                  <label className={labelCls}>Payout Type</label>
                  <select className={inputCls} value={addForm.payoutType} onChange={(e) => setF("payoutType", e.target.value)}>
                    <option value="per_class">Per Class</option>
                    <option value="salary">Monthly Salary</option>
                    <option value="revenue_share">Revenue Share</option>
                  </select>
                </div>

                {addForm.payoutType === "salary" ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Monthly Salary (PKR)</label>
                      <input type="number" min="0" className={inputCls} value={addForm.salary} onChange={(e) => setF("salary", e.target.value)} placeholder="50000" />
                    </div>
                    <div>
                      <label className={labelCls}>Due Day of Month</label>
                      <input type="number" min="1" max="31" className={inputCls} value={addForm.salaryDueDay} onChange={(e) => setF("salaryDueDay", e.target.value)} placeholder="1" />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className={labelCls}>Rate (PKR)</label>
                    <input type="number" min="0" className={inputCls} value={addForm.payoutRate} onChange={(e) => setF("payoutRate", e.target.value)} placeholder="1500" />
                  </div>
                )}

                <div>
                  <label className={labelCls}>Commission % <span className="text-stone-400">(on referral clients, optional)</span></label>
                  <input type="number" min="0" max="100" step="0.5" className={inputCls} value={addForm.commissionPercent} onChange={(e) => setF("commissionPercent", e.target.value)} placeholder="5" />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className={labelCls}>Notes <span className="text-stone-400">(optional)</span></label>
                <textarea className={cn(inputCls, "resize-none")} rows={2} value={addForm.notes} onChange={(e) => setF("notes", e.target.value)} placeholder="Any internal notes…" />
              </div>

              <div className="flex gap-3 pt-2 border-t border-stone-100">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowAddForm(false)}>Cancel</Button>
                <Button type="submit" className="flex-1" loading={saving}>
                  {saving ? "Adding…" : "Add Instructor"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Summary card ─────────────────────────────────────────────────────────────

function SummaryCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-1">
        <span className={cn("", color)}>{icon}</span>
        <span className="text-2xl font-bold text-stone-900">{value}</span>
      </div>
      <p className="text-xs text-stone-500">{label}</p>
    </Card>
  );
}

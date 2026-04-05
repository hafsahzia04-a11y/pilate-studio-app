"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn, formatTime, formatCurrency } from "@/lib/utils";
import {
  Phone, Mail, Calendar, Pencil, X, Plus, ChevronLeft,
  Wallet, Users, TrendingUp, CheckCircle2, AlertCircle,
  UserPlus, BarChart2, Clock, Trash2, RefreshCw,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import toast from "react-hot-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClassSession {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  status: string;
  capacity: number;
  bookedCount: number;
  category: { name: string; color: string };
  classMetric: { bookedCount: number; attendedCount: number; noShowCount: number } | null;
}

interface SalaryRecord {
  id: string;
  month: number;
  year: number;
  amountDue: number;
  amountPaid: number;
  paymentStatus: string;
  dueDate: string;
  paidAt: string | null;
  paymentMethod: string | null;
  notes: string | null;
}

interface Referral {
  id: string;
  clientId: string;
  isActive: boolean;
  referralDate: string;
  notes: string | null;
  client: { id: string; fullName: string; email: string; status: string };
  clientPackage?: { id: string; packageName: string; amountDue: number } | null;
  commissionAmount?: number;
}

interface Instructor {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  status: string;
  createdAt: string;
  instructorProfile: {
    bio: string | null;
    specializations: string[];
    payoutType: string;
    payoutRate: number;
    salary: number | null;
    salaryDueDay: number | null;
    commissionPercent: number | null;
    startDate: string | null;
    isAvailable: boolean;
    notes: string | null;
  } | null;
  classSessions: ClassSession[];
  salaryRecords: SalaryRecord[];
  instructorReferrals: Referral[];
}

interface Props {
  instructor: Instructor;
  allClients: { id: string; fullName: string; email: string }[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const inputCls = "w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 outline-none focus:border-sage-400 focus:ring-2 focus:ring-sage-100";
const labelCls = "block text-xs font-medium text-stone-600 mb-1";

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function salaryStatusBadge(record: SalaryRecord) {
  const overdue = record.paymentStatus !== "paid" && new Date(record.dueDate) < new Date();
  if (overdue) return <Badge variant="danger">Overdue</Badge>;
  if (record.paymentStatus === "paid") return <Badge variant="sage">Paid</Badge>;
  if (record.paymentStatus === "partial") return <Badge variant="warning">Partial</Badge>;
  return <Badge variant="warning">Unpaid</Badge>;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function InstructorDetail({ instructor: initial, allClients }: Props) {
  const router = useRouter();
  const [instructor, setInstructor] = useState(initial);
  const [activeTab, setActiveTab] = useState<"overview" | "salary" | "referrals" | "sessions">("overview");

  // Edit profile modal
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    fullName: initial.fullName,
    phone: initial.phone ?? "",
    status: initial.status,
    bio: initial.instructorProfile?.bio ?? "",
    specializations: initial.instructorProfile?.specializations.join(", ") ?? "",
    payoutType: initial.instructorProfile?.payoutType ?? "per_class",
    payoutRate: String(initial.instructorProfile?.payoutRate ?? ""),
    salary: String(initial.instructorProfile?.salary ?? ""),
    salaryDueDay: String(initial.instructorProfile?.salaryDueDay ?? ""),
    commissionPercent: String(initial.instructorProfile?.commissionPercent ?? ""),
    startDate: initial.instructorProfile?.startDate ? format(parseISO(initial.instructorProfile.startDate), "yyyy-MM-dd") : "",
    notes: initial.instructorProfile?.notes ?? "",
  });

  // Add salary record modal
  const [showSalaryForm, setShowSalaryForm] = useState(false);
  const [salaryForm, setSalaryForm] = useState({
    month: String(new Date().getMonth() + 1),
    year: String(new Date().getFullYear()),
    amountDue: String(initial.instructorProfile?.salary ?? ""),
    dueDate: "",
    notes: "",
    isRecurring: false,
    recurringMonths: "3",
  });

  // Record salary payment modal
  const [payingRecord, setPayingRecord] = useState<SalaryRecord | null>(null);
  const [payForm, setPayForm] = useState({ amountPaid: "", paymentMethod: "cash", notes: "" });

  // Add referral modal
  const [showReferralForm, setShowReferralForm] = useState(false);
  const [referralForm, setReferralForm] = useState({ clientId: "", referralDate: format(new Date(), "yyyy-MM-dd"), notes: "" });

  // Inline referral edit
  const [editingReferralId, setEditingReferralId] = useState<string | null>(null);
  const [referralEditForm, setReferralEditForm] = useState({ referralDate: "", notes: "", isActive: true });

  // Attendance modal
  const [attendanceSession, setAttendanceSession] = useState<ClassSession | null>(null);
  const [attendanceForm, setAttendanceForm] = useState({ bookedCount: "", attendedCount: "", noShowCount: "", notes: "" });

  const [saving, setSaving] = useState(false);

  // ── Analytics ────────────────────────────────────────────────────────────────

  const completedSessions = instructor.classSessions.filter((s) => s.status === "completed");
  const sessionsWithMetrics = completedSessions.filter((s) => s.classMetric !== null);
  const avgAttendance = sessionsWithMetrics.length > 0
    ? Math.round(sessionsWithMetrics.reduce((sum, s) => sum + (s.classMetric!.attendedCount / Math.max(s.classMetric!.bookedCount, 1)), 0) / sessionsWithMetrics.length * 100)
    : null;
  const totalAttended = sessionsWithMetrics.reduce((sum, s) => sum + (s.classMetric?.attendedCount ?? 0), 0);
  const activeReferrals = instructor.instructorReferrals.filter((r) => r.isActive).length;

  // ── Handlers ─────────────────────────────────────────────────────────────────

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/instructors/${instructor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: editForm.fullName.trim(),
          phone: editForm.phone.trim() || null,
          status: editForm.status,
          bio: editForm.bio.trim() || null,
          specializations: editForm.specializations.split(",").map((s) => s.trim()).filter(Boolean),
          payoutType: editForm.payoutType,
          payoutRate: editForm.payoutRate ? Number(editForm.payoutRate) : 0,
          salary: editForm.salary ? Number(editForm.salary) : null,
          salaryDueDay: editForm.salaryDueDay ? Number(editForm.salaryDueDay) : null,
          commissionPercent: editForm.commissionPercent ? Number(editForm.commissionPercent) : null,
          startDate: editForm.startDate || null,
          notes: editForm.notes.trim() || null,
        }),
      });
      if (!res.ok) { const d = await res.json(); toast.error(d.error ?? "Failed to update"); return; }
      toast.success("Instructor updated");
      setShowEdit(false);
      router.refresh();
    } finally { setSaving(false); }
  }

  async function saveSalaryRecord(e: React.FormEvent) {
    e.preventDefault();
    if (!salaryForm.dueDate) { toast.error("Due date is required"); return; }
    setSaving(true);
    try {
      const months = salaryForm.isRecurring ? Math.max(1, Number(salaryForm.recurringMonths)) : 1;
      let startMonth = Number(salaryForm.month);
      let startYear = Number(salaryForm.year);
      const baseDate = new Date(salaryForm.dueDate);
      let created = 0;

      for (let i = 0; i < months; i++) {
        // Compute due date for this iteration: same day, offset by i months
        const dueDate = new Date(baseDate);
        dueDate.setMonth(dueDate.getMonth() + i);
        const m = (startMonth - 1 + i) % 12 + 1;
        const y = startYear + Math.floor((startMonth - 1 + i) / 12);

        const res = await fetch(`/api/instructors/${instructor.id}/salary`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            month: m,
            year: y,
            amountDue: Number(salaryForm.amountDue),
            dueDate: dueDate.toISOString(),
            notes: salaryForm.notes.trim() || null,
          }),
        });
        if (res.ok) created++;
      }

      toast.success(salaryForm.isRecurring ? `${created} salary records created` : "Salary record saved");
      setShowSalaryForm(false);
      router.refresh();
    } finally { setSaving(false); }
  }

  async function deleteInstructor() {
    if (!confirm(`Permanently deactivate ${instructor.fullName}? They will be marked inactive and removed from scheduling.`)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/instructors/${instructor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "inactive" }),
      });
      if (!res.ok) { const d = await res.json(); toast.error(d.error ?? "Failed"); return; }
      toast.success("Instructor deactivated");
      router.push("/founder/instructors");
    } finally { setSaving(false); }
  }

  async function recordPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!payingRecord) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/instructors/${instructor.id}/salary`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recordId: payingRecord.id,
          amountPaid: Number(payForm.amountPaid),
          paymentMethod: payForm.paymentMethod,
          notes: payForm.notes.trim() || null,
        }),
      });
      if (!res.ok) { const d = await res.json(); toast.error(d.error ?? "Failed"); return; }
      toast.success("Payment recorded");
      setPayingRecord(null);
      router.refresh();
    } finally { setSaving(false); }
  }

  async function addReferral(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/instructors/${instructor.id}/referrals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: referralForm.clientId,
          referralDate: referralForm.referralDate,
          notes: referralForm.notes.trim() || null,
        }),
      });
      if (!res.ok) { const d = await res.json(); toast.error(d.error ?? "Failed"); return; }
      toast.success("Referral added");
      setShowReferralForm(false);
      router.refresh();
    } finally { setSaving(false); }
  }

  async function toggleReferral(referralId: string, isActive: boolean) {
    const res = await fetch(`/api/instructors/${instructor.id}/referrals`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ referralId, isActive }),
    });
    if (res.ok) {
      toast.success(isActive ? "Referral marked active" : "Referral marked inactive");
      router.refresh();
    } else {
      const d = await res.json(); toast.error(d.error ?? "Failed");
    }
  }

  function openReferralEdit(r: Referral) {
    setEditingReferralId(r.id);
    setReferralEditForm({
      referralDate: format(parseISO(r.referralDate), "yyyy-MM-dd"),
      notes: r.notes ?? "",
      isActive: r.isActive,
    });
  }

  async function saveReferralEdit(referralId: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/instructors/${instructor.id}/referrals`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referralId,
          isActive: referralEditForm.isActive,
          notes: referralEditForm.notes.trim() || null,
          referralDate: referralEditForm.referralDate,
        }),
      });
      if (!res.ok) { const d = await res.json(); toast.error(d.error ?? "Failed"); return; }
      toast.success("Referral updated");
      setEditingReferralId(null);
      router.refresh();
    } finally { setSaving(false); }
  }

  async function saveAttendance(e: React.FormEvent) {
    e.preventDefault();
    if (!attendanceSession) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/classes/${attendanceSession.id}/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookedCount: Number(attendanceForm.bookedCount),
          attendedCount: Number(attendanceForm.attendedCount),
          noShowCount: Number(attendanceForm.noShowCount),
          notes: attendanceForm.notes.trim() || null,
        }),
      });
      if (!res.ok) { const d = await res.json(); toast.error(d.error ?? "Failed"); return; }
      toast.success("Attendance recorded");
      setAttendanceSession(null);
      router.refresh();
    } finally { setSaving(false); }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const tabs = [
    { id: "overview" as const, label: "Overview" },
    { id: "salary" as const, label: "Salary" },
    { id: "referrals" as const, label: `Referrals (${instructor.instructorReferrals.length})` },
    { id: "sessions" as const, label: `Sessions (${instructor.classSessions.length})` },
  ];

  return (
    <div className="space-y-6">
      {/* Back */}
      <Link href="/founder/instructors" className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-700 transition-colors">
        <ChevronLeft className="h-4 w-4" /> All Instructors
      </Link>

      {/* Header card */}
      <Card className="p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-sage-100 flex items-center justify-center flex-shrink-0">
              <span className="text-sage-700 text-xl font-bold">{instructor.fullName.charAt(0).toUpperCase()}</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-stone-900">{instructor.fullName}</h1>
              <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-stone-500">
                <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{instructor.email}</span>
                {instructor.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{instructor.phone}</span>}
                {instructor.instructorProfile?.startDate && (
                  <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />Since {format(parseISO(instructor.instructorProfile.startDate), "MMM yyyy")}</span>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                <Badge variant={instructor.status === "active" ? "sage" : "default"}>{instructor.status}</Badge>
                {(instructor.instructorProfile?.specializations ?? []).map((s) => (
                  <Badge key={s} variant="default">{s}</Badge>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowEdit(true)}>
              <Pencil className="h-3.5 w-3.5" /> Edit Profile
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-red-500 border-red-200 hover:bg-red-50"
              onClick={deleteInstructor}
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
          </div>
        </div>

        {instructor.instructorProfile?.bio && (
          <p className="mt-4 text-sm text-stone-600 border-t border-stone-100 pt-4">{instructor.instructorProfile.bio}</p>
        )}

        {/* Quick stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5 pt-5 border-t border-stone-100">
          <QuickStat label="Total Sessions" value={instructor.classSessions.length} icon={<Calendar className="h-4 w-4 text-stone-400" />} />
          <QuickStat label="Avg Attendance" value={avgAttendance != null ? `${avgAttendance}%` : "—"} icon={<TrendingUp className="h-4 w-4 text-sage-400" />} />
          <QuickStat label="Total Attended" value={totalAttended} icon={<Users className="h-4 w-4 text-blue-400" />} />
          <QuickStat label="Active Referrals" value={activeReferrals} icon={<UserPlus className="h-4 w-4 text-purple-400" />} />
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex gap-1 bg-stone-100 p-1 rounded-xl overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={cn(
              "flex-1 min-w-max px-4 py-2 rounded-lg text-sm font-medium transition-all",
              activeTab === t.id ? "bg-white shadow-card text-stone-900" : "text-stone-500 hover:text-stone-700"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Overview ─────────────────────────────────────────────────────── */}
      {activeTab === "overview" && (
        <div className="grid md:grid-cols-2 gap-4">
          {/* Pay structure */}
          <Card className="p-5 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="h-4 w-4 text-stone-400" />
              <h3 className="text-sm font-semibold text-stone-700">Pay Structure</h3>
            </div>
            <InfoRow label="Payout Type" value={instructor.instructorProfile?.payoutType ?? "—"} />
            {instructor.instructorProfile?.payoutType === "salary" ? (
              <>
                <InfoRow label="Monthly Salary" value={instructor.instructorProfile.salary != null ? `PKR ${instructor.instructorProfile.salary.toLocaleString()}` : "—"} />
                <InfoRow label="Due Day" value={instructor.instructorProfile.salaryDueDay != null ? `Day ${instructor.instructorProfile.salaryDueDay} of month` : "—"} />
              </>
            ) : (
              <InfoRow label="Rate" value={`PKR ${instructor.instructorProfile?.payoutRate?.toLocaleString() ?? "—"}`} />
            )}
            {instructor.instructorProfile?.commissionPercent != null && (
              <InfoRow label="Commission" value={`${instructor.instructorProfile.commissionPercent}%`} />
            )}
          </Card>

          {/* Notes */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-stone-700 mb-3">Internal Notes</h3>
            {instructor.instructorProfile?.notes ? (
              <p className="text-sm text-stone-600 whitespace-pre-line">{instructor.instructorProfile.notes}</p>
            ) : (
              <p className="text-sm text-stone-300 italic">No notes recorded.</p>
            )}
          </Card>
        </div>
      )}

      {/* ── Tab: Salary ───────────────────────────────────────────────────────── */}
      {activeTab === "salary" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setShowSalaryForm(true)}>
              <Plus className="h-4 w-4" /> Add Salary Record
            </Button>
          </div>

          {instructor.salaryRecords.length === 0 ? (
            <Card className="p-10 text-center text-stone-400">
              <Wallet className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No salary records yet</p>
            </Card>
          ) : (
            <div className="rounded-2xl border border-stone-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-stone-50 border-b border-stone-100">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-stone-500">Period</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-stone-500">Due</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-stone-500">Amount</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-stone-500">Paid</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-stone-500">Status</th>
                    <th className="w-24" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50">
                  {instructor.salaryRecords.map((r) => (
                    <tr key={r.id} className="hover:bg-cream-50">
                      <td className="px-4 py-3 font-medium text-stone-800">
                        {MONTH_NAMES[r.month - 1]} {r.year}
                      </td>
                      <td className="px-4 py-3 text-stone-600">
                        {format(parseISO(r.dueDate), "d MMM yyyy")}
                      </td>
                      <td className="px-4 py-3 text-stone-800">PKR {r.amountDue.toLocaleString()}</td>
                      <td className="px-4 py-3 text-stone-600">PKR {r.amountPaid.toLocaleString()}</td>
                      <td className="px-4 py-3">{salaryStatusBadge(r)}</td>
                      <td className="pr-4 text-right">
                        {r.paymentStatus !== "paid" && (
                          <button
                            onClick={() => { setPayingRecord(r); setPayForm({ amountPaid: String(r.amountDue - r.amountPaid), paymentMethod: "cash", notes: "" }); }}
                            className="text-xs text-sage-600 hover:underline"
                          >
                            Record Payment
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Referrals ─────────────────────────────────────────────────────── */}
      {activeTab === "referrals" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-stone-400 italic">Commission = 15% of client&apos;s active package value</p>
            <Button size="sm" onClick={() => setShowReferralForm(true)}>
              <UserPlus className="h-4 w-4" /> Add Referral
            </Button>
          </div>

          {instructor.instructorReferrals.length === 0 ? (
            <Card className="p-10 text-center text-stone-400">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No referrals tracked yet</p>
            </Card>
          ) : (
            <div className="rounded-2xl border border-stone-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-stone-50 border-b border-stone-100">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-stone-500">Client</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-stone-500">Referred</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-stone-500">Active Package</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-stone-500">Commission (15%)</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-stone-500">Status</th>
                    <th className="w-20" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50">
                  {instructor.instructorReferrals.map((r) => (
                    <>
                      <tr key={r.id} className="hover:bg-cream-50">
                        <td className="px-4 py-3">
                          <Link href={`/founder/clients/${r.clientId}`} className="font-medium text-stone-900 hover:text-sage-700 hover:underline">
                            {r.client.fullName}
                          </Link>
                          <p className="text-xs text-stone-400">{r.client.email}</p>
                        </td>
                        <td className="px-4 py-3 text-stone-600">{format(parseISO(r.referralDate), "d MMM yyyy")}</td>
                        <td className="px-4 py-3 text-stone-600">
                          {r.clientPackage
                            ? <span>{r.clientPackage.packageName} <span className="text-stone-400">(PKR {r.clientPackage.amountDue.toLocaleString()})</span></span>
                            : <span className="text-stone-300">No active package</span>}
                        </td>
                        <td className="px-4 py-3 font-medium">
                          {r.isActive && (r.commissionAmount ?? 0) > 0
                            ? <span className="text-sage-700">PKR {(r.commissionAmount ?? 0).toLocaleString()}</span>
                            : <span className="text-stone-300">{r.isActive ? "PKR 0" : "Inactive"}</span>}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={r.isActive ? "sage" : "default"}>{r.isActive ? "Active" : "Inactive"}</Badge>
                        </td>
                        <td className="pr-4 text-right">
                          <button
                            onClick={() => openReferralEdit(r)}
                            className="text-stone-400 hover:text-stone-700 transition-colors"
                            title="Edit referral"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                      {editingReferralId === r.id && (
                        <tr key={`${r.id}-edit`} className="bg-stone-50">
                          <td colSpan={6} className="px-4 py-4">
                            <div className="flex flex-wrap items-end gap-3">
                              <div>
                                <label className={labelCls}>Referral Date</label>
                                <input
                                  type="date"
                                  className={inputCls}
                                  value={referralEditForm.referralDate}
                                  onChange={(e) => setReferralEditForm((f) => ({ ...f, referralDate: e.target.value }))}
                                />
                              </div>
                              <div className="flex-1 min-w-40">
                                <label className={labelCls}>Notes</label>
                                <input
                                  className={inputCls}
                                  value={referralEditForm.notes}
                                  onChange={(e) => setReferralEditForm((f) => ({ ...f, notes: e.target.value }))}
                                  placeholder="Optional notes"
                                />
                              </div>
                              <div>
                                <label className={labelCls}>Status</label>
                                <select
                                  className={inputCls}
                                  value={referralEditForm.isActive ? "active" : "inactive"}
                                  onChange={(e) => setReferralEditForm((f) => ({ ...f, isActive: e.target.value === "active" }))}
                                >
                                  <option value="active">Active</option>
                                  <option value="inactive">Inactive</option>
                                </select>
                              </div>
                              <div className="flex gap-2">
                                <Button size="sm" onClick={() => saveReferralEdit(r.id)} loading={saving}>Save</Button>
                                <Button size="sm" variant="outline" onClick={() => setEditingReferralId(null)}>Cancel</Button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
                <tfoot className="bg-stone-50 border-t border-stone-200">
                  <tr>
                    <td colSpan={3} className="px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">
                      Total Commission (active referrals)
                    </td>
                    <td className="px-4 py-3 font-bold text-stone-900">
                      PKR {instructor.instructorReferrals
                        .filter((r) => r.isActive)
                        .reduce((sum, r) => sum + (r.commissionAmount ?? 0), 0)
                        .toLocaleString()}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Sessions ─────────────────────────────────────────────────────── */}
      {activeTab === "sessions" && (
        <div className="space-y-4">
          {instructor.classSessions.length === 0 ? (
            <Card className="p-10 text-center text-stone-400">
              <Calendar className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No sessions found</p>
            </Card>
          ) : (
            <div className="rounded-2xl border border-stone-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-stone-50 border-b border-stone-100">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-stone-500">Class</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-stone-500">Date & Time</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-stone-500">Booked</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-stone-500">Attendance</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-stone-500">Status</th>
                    <th className="w-28" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50">
                  {instructor.classSessions.map((s) => (
                    <tr key={s.id} className="hover:bg-cream-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.category.color }} />
                          <div>
                            <p className="font-medium text-stone-900">{s.title}</p>
                            <p className="text-xs text-stone-400">{s.category.name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-stone-600">
                        <p>{format(parseISO(s.startTime), "d MMM yyyy")}</p>
                        <p className="text-xs text-stone-400">{formatTime(s.startTime)} – {formatTime(s.endTime)}</p>
                      </td>
                      <td className="px-4 py-3 text-stone-700">{s.bookedCount}/{s.capacity}</td>
                      <td className="px-4 py-3">
                        {s.classMetric ? (
                          <div>
                            <p className="text-stone-700">{s.classMetric.attendedCount} attended</p>
                            <p className="text-xs text-stone-400">{s.classMetric.noShowCount} no-show</p>
                          </div>
                        ) : (
                          <span className="text-xs text-stone-300">Not recorded</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={s.status === "completed" ? "sage" : s.status === "cancelled" ? "danger" : "default"}>
                          {s.status}
                        </Badge>
                      </td>
                      <td className="pr-4 text-right">
                        {s.status === "completed" && (
                          <button
                            onClick={() => {
                              setAttendanceSession(s);
                              setAttendanceForm({
                                bookedCount: String(s.classMetric?.bookedCount ?? s.bookedCount),
                                attendedCount: String(s.classMetric?.attendedCount ?? ""),
                                noShowCount: String(s.classMetric?.noShowCount ?? ""),
                                notes: "",
                              });
                            }}
                            className="text-xs text-sage-600 hover:underline"
                          >
                            {s.classMetric ? "Edit Attendance" : "Record Attendance"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Edit Profile Modal ─────────────────────────────────────────────────── */}
      {showEdit && (
        <Modal title="Edit Instructor" onClose={() => setShowEdit(false)}>
          <form onSubmit={saveEdit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Full Name *</label>
                <input className={inputCls} value={editForm.fullName} onChange={(e) => setEditForm((f) => ({ ...f, fullName: e.target.value }))} required />
              </div>
              <div>
                <label className={labelCls}>Phone</label>
                <input className={inputCls} value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Status</label>
                <select className={inputCls} value={editForm.status} onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Start Date</label>
                <input type="date" className={inputCls} value={editForm.startDate} onChange={(e) => setEditForm((f) => ({ ...f, startDate: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Bio</label>
              <textarea className={cn(inputCls, "resize-none")} rows={2} value={editForm.bio} onChange={(e) => setEditForm((f) => ({ ...f, bio: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>What They Teach <span className="text-stone-400">(comma-separated)</span></label>
              <input className={inputCls} value={editForm.specializations} onChange={(e) => setEditForm((f) => ({ ...f, specializations: e.target.value }))} placeholder="Pilates, Yoga" />
            </div>
            <div className="rounded-xl border border-stone-200 p-4 space-y-3 bg-stone-50">
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Pay Structure</p>
              <div>
                <label className={labelCls}>Payout Type</label>
                <select className={inputCls} value={editForm.payoutType} onChange={(e) => setEditForm((f) => ({ ...f, payoutType: e.target.value }))}>
                  <option value="per_class">Per Class</option>
                  <option value="salary">Monthly Salary</option>
                  <option value="revenue_share">Revenue Share</option>
                </select>
              </div>
              {editForm.payoutType === "salary" ? (
                <div className="space-y-3">
                  <div>
                    <label className={labelCls}>Monthly Salary (PKR)</label>
                    <input type="number" className={inputCls} value={editForm.salary} onChange={(e) => setEditForm((f) => ({ ...f, salary: e.target.value }))} placeholder="e.g. 50000" />
                  </div>
                  <div>
                    <label className={labelCls}>Salary Due Day <span className="text-stone-400">(day of month, e.g. 1 = 1st of each month)</span></label>
                    <input type="number" min="1" max="31" className={inputCls} value={editForm.salaryDueDay} onChange={(e) => setEditForm((f) => ({ ...f, salaryDueDay: e.target.value }))} placeholder="e.g. 1" />
                    <p className="text-xs text-stone-400 mt-1">Use the Salary tab to create individual monthly records with exact due dates.</p>
                  </div>
                </div>
              ) : (
                <div>
                  <label className={labelCls}>Rate (PKR)</label>
                  <input type="number" className={inputCls} value={editForm.payoutRate} onChange={(e) => setEditForm((f) => ({ ...f, payoutRate: e.target.value }))} />
                </div>
              )}
              <div>
                <label className={labelCls}>Commission % (optional)</label>
                <input type="number" min="0" max="100" step="0.5" className={inputCls} value={editForm.commissionPercent} onChange={(e) => setEditForm((f) => ({ ...f, commissionPercent: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Internal Notes</label>
              <textarea className={cn(inputCls, "resize-none")} rows={2} value={editForm.notes} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
            <ModalActions onClose={() => setShowEdit(false)} saving={saving} submitLabel="Save Changes" />
          </form>
        </Modal>
      )}

      {/* ── Add Salary Record Modal ────────────────────────────────────────────── */}
      {showSalaryForm && (
        <Modal title="Add Salary Record" onClose={() => setShowSalaryForm(false)}>
          <form onSubmit={saveSalaryRecord} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Starting Month *</label>
                <select className={inputCls} value={salaryForm.month} onChange={(e) => setSalaryForm((f) => ({ ...f, month: e.target.value }))}>
                  {MONTH_NAMES.map((m, i) => <option key={i} value={String(i + 1)}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Year *</label>
                <input type="number" className={inputCls} value={salaryForm.year} onChange={(e) => setSalaryForm((f) => ({ ...f, year: e.target.value }))} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Amount Due (PKR) *</label>
                <input type="number" min="0" className={inputCls} value={salaryForm.amountDue} onChange={(e) => setSalaryForm((f) => ({ ...f, amountDue: e.target.value }))} required />
              </div>
              <div>
                <label className={labelCls}>Due Date *</label>
                <input
                  type="date"
                  className={inputCls}
                  value={salaryForm.dueDate}
                  onChange={(e) => setSalaryForm((f) => ({ ...f, dueDate: e.target.value }))}
                  required
                />
              </div>
            </div>

            {/* Recurring toggle */}
            <div className="rounded-xl border border-stone-200 p-4 bg-stone-50 space-y-3">
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-stone-500" />
                  <div>
                    <p className="text-sm font-medium text-stone-700">Recurring (monthly)</p>
                    <p className="text-xs text-stone-400">Auto-create records for multiple months</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSalaryForm((f) => ({ ...f, isRecurring: !f.isRecurring }))}
                  className={cn("relative inline-flex h-6 w-11 items-center rounded-full transition-colors", salaryForm.isRecurring ? "bg-sage-500" : "bg-stone-200")}
                >
                  <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform", salaryForm.isRecurring ? "translate-x-6" : "translate-x-1")} />
                </button>
              </label>
              {salaryForm.isRecurring && (
                <div>
                  <label className={labelCls}>Generate records for how many months?</label>
                  <select className={inputCls} value={salaryForm.recurringMonths} onChange={(e) => setSalaryForm((f) => ({ ...f, recurringMonths: e.target.value }))}>
                    {[2,3,4,6,9,12].map((n) => <option key={n} value={String(n)}>{n} months</option>)}
                  </select>
                  <p className="text-xs text-stone-400 mt-1">
                    Due dates will shift forward by 1 month each record. Records already existing for a month will be updated.
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className={labelCls}>Notes</label>
              <input className={inputCls} value={salaryForm.notes} onChange={(e) => setSalaryForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Optional" />
            </div>
            <ModalActions onClose={() => setShowSalaryForm(false)} saving={saving} submitLabel={salaryForm.isRecurring ? `Create ${salaryForm.recurringMonths} Records` : "Save Record"} />
          </form>
        </Modal>
      )}

      {/* ── Record Payment Modal ───────────────────────────────────────────────── */}
      {payingRecord && (
        <Modal title="Record Salary Payment" onClose={() => setPayingRecord(null)}>
          <form onSubmit={recordPayment} className="space-y-4">
            <div className="bg-stone-50 rounded-xl p-3 text-sm text-stone-600 space-y-1">
              <p><span className="font-medium">Period:</span> {MONTH_NAMES[payingRecord.month - 1]} {payingRecord.year}</p>
              <p><span className="font-medium">Remaining:</span> PKR {(payingRecord.amountDue - payingRecord.amountPaid).toLocaleString()}</p>
            </div>
            <div>
              <label className={labelCls}>Amount Paying (PKR) *</label>
              <input type="number" min="0" className={inputCls} value={payForm.amountPaid} onChange={(e) => setPayForm((f) => ({ ...f, amountPaid: e.target.value }))} required />
            </div>
            <div>
              <label className={labelCls}>Payment Method</label>
              <select className={inputCls} value={payForm.paymentMethod} onChange={(e) => setPayForm((f) => ({ ...f, paymentMethod: e.target.value }))}>
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cheque">Cheque</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Notes</label>
              <input className={inputCls} value={payForm.notes} onChange={(e) => setPayForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Optional" />
            </div>
            <ModalActions onClose={() => setPayingRecord(null)} saving={saving} submitLabel="Record Payment" />
          </form>
        </Modal>
      )}

      {/* ── Add Referral Modal ─────────────────────────────────────────────────── */}
      {showReferralForm && (
        <Modal title="Add Referral" onClose={() => setShowReferralForm(false)}>
          <form onSubmit={addReferral} className="space-y-4">
            <div>
              <label className={labelCls}>Client *</label>
              <select className={inputCls} value={referralForm.clientId} onChange={(e) => setReferralForm((f) => ({ ...f, clientId: e.target.value }))} required>
                <option value="">Select client…</option>
                {allClients.map((c) => (
                  <option key={c.id} value={c.id}>{c.fullName} ({c.email})</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Referral Date *</label>
              <input type="date" className={inputCls} value={referralForm.referralDate} onChange={(e) => setReferralForm((f) => ({ ...f, referralDate: e.target.value }))} required />
            </div>
            <div>
              <label className={labelCls}>Notes</label>
              <input className={inputCls} value={referralForm.notes} onChange={(e) => setReferralForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Optional" />
            </div>
            <ModalActions onClose={() => setShowReferralForm(false)} saving={saving} submitLabel="Add Referral" />
          </form>
        </Modal>
      )}

      {/* ── Record Attendance Modal ────────────────────────────────────────────── */}
      {attendanceSession && (
        <Modal title="Record Attendance" onClose={() => setAttendanceSession(null)}>
          <form onSubmit={saveAttendance} className="space-y-4">
            <div className="bg-stone-50 rounded-xl p-3 text-sm text-stone-600">
              <p className="font-medium">{attendanceSession.title}</p>
              <p className="text-xs text-stone-400 mt-0.5">{format(parseISO(attendanceSession.startTime), "d MMM yyyy")} · {formatTime(attendanceSession.startTime)}</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Booked *</label>
                <input type="number" min="0" className={inputCls} value={attendanceForm.bookedCount} onChange={(e) => setAttendanceForm((f) => ({ ...f, bookedCount: e.target.value }))} required />
              </div>
              <div>
                <label className={labelCls}>Attended *</label>
                <input type="number" min="0" className={inputCls} value={attendanceForm.attendedCount} onChange={(e) => setAttendanceForm((f) => ({ ...f, attendedCount: e.target.value }))} required />
              </div>
              <div>
                <label className={labelCls}>No-Show *</label>
                <input type="number" min="0" className={inputCls} value={attendanceForm.noShowCount} onChange={(e) => setAttendanceForm((f) => ({ ...f, noShowCount: e.target.value }))} required />
              </div>
            </div>
            <div>
              <label className={labelCls}>Notes</label>
              <input className={inputCls} value={attendanceForm.notes} onChange={(e) => setAttendanceForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Optional" />
            </div>
            <ModalActions onClose={() => setAttendanceSession(null)} saving={saving} submitLabel="Save Attendance" />
          </form>
        </Modal>
      )}
    </div>
  );
}

// ─── Shared sub-components ─────────────────────────────────────────────────────

function QuickStat({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-1.5 mb-1">{icon}<span className="text-xl font-bold text-stone-900">{value}</span></div>
      <p className="text-xs text-stone-400">{label}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-stone-500">{label}</span>
      <span className="text-stone-800 font-medium capitalize">{value}</span>
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
          <h2 className="text-base font-semibold text-stone-900">{title}</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 transition-colors"><X className="h-5 w-5" /></button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

function ModalActions({ onClose, saving, submitLabel }: { onClose: () => void; saving: boolean; submitLabel: string }) {
  return (
    <div className="flex gap-3 pt-2 border-t border-stone-100">
      <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
      <Button type="submit" className="flex-1" loading={saving}>{saving ? "Saving…" : submitLabel}</Button>
    </div>
  );
}

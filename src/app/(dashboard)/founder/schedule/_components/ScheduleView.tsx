"use client";

import { useState, useRef } from "react";
import { format, addDays, startOfDay, isSameDay } from "date-fns";
import { cn, formatTime, occupancyColor } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Plus, Users, Clock, MapPin, ChevronLeft, ChevronRight,
  X, RefreshCw, Pencil, LayoutGrid, List,
} from "lucide-react";
import toast from "react-hot-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Session {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  durationMins: number;
  capacity: number;
  bookedCount: number;
  waitlistCount: number;
  spotsLeft: number;
  isFull: boolean;
  room?: string | null;
  status: string;
  isWorkshop: boolean;
  description?: string | null;
  category: { name: string; color: string };
  instructor: { id: string; fullName: string };
  substituteInstructor?: { id: string; fullName: string } | null;
}

interface ScheduleViewProps {
  sessions: Session[];
  instructors: { id: string; fullName: string }[];
  categories: { id: string; name: string; color: string }[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const inputCls = "w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 outline-none focus:border-sage-400 focus:ring-2 focus:ring-sage-100";
const labelCls = "block text-xs font-medium text-stone-600 mb-1";

// Time grid: 6am – 10pm = 16 hours, each hour = 64px
const GRID_START_HOUR = 6;
const GRID_END_HOUR = 22;
const HOUR_PX = 64;
const TOTAL_HOURS = GRID_END_HOUR - GRID_START_HOUR;

function timeToOffset(date: Date): number {
  const hours = date.getHours() + date.getMinutes() / 60;
  return (hours - GRID_START_HOUR) * HOUR_PX;
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ScheduleView({ sessions: initialSessions, instructors, categories }: ScheduleViewProps) {
  const [sessions, setSessions] = useState(initialSessions);
  const [weekStart, setWeekStart] = useState(startOfDay(new Date()));
  const [view, setView] = useState<"list" | "week">("list");
  const [selectedDay, setSelectedDay] = useState(0);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editSession, setEditSession] = useState<Session | null>(null);
  const [saving, setSaving] = useState(false);

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const selectedDate = days[selectedDay];
  const daySessions = sessions.filter((s) => isSameDay(new Date(s.startTime), selectedDate));

  // ── Add class form state ────────────────────────────────────────────────────

  const defaultDate = format(selectedDate, "yyyy-MM-dd");
  const [addForm, setAddForm] = useState({
    title: "",
    categoryId: categories[0]?.id ?? "",
    instructorName: instructors[0]?.fullName ?? "",
    date: defaultDate,
    startTime: "09:00",
    durationMins: "60",
    capacity: "12",
    room: "",
    isWorkshop: false,
    workshopPrice: "",
    usesCredits: true,
    description: "",
    isRecurring: false,
    repeatWeeks: "4",
  });

  function setAdd(field: string, value: string | boolean) {
    setAddForm((f) => ({ ...f, [field]: value }));
  }

  function openAddForm() {
    setAddForm((f) => ({ ...f, date: format(selectedDate, "yyyy-MM-dd") }));
    setShowAddForm(true);
  }

  // ── Edit form state ─────────────────────────────────────────────────────────

  const [editForm, setEditForm] = useState({
    title: "",
    categoryId: "",
    instructorName: "",
    date: "",
    startTime: "",
    durationMins: "",
    capacity: "",
    room: "",
    description: "",
    status: "scheduled",
  });

  function openEdit(s: Session) {
    const start = new Date(s.startTime);
    setEditForm({
      title: s.title,
      categoryId: categories.find((c) => c.name === s.category.name)?.id ?? categories[0]?.id ?? "",
      instructorName: s.instructor.fullName,
      date: format(start, "yyyy-MM-dd"),
      startTime: format(start, "HH:mm"),
      durationMins: String(s.durationMins),
      capacity: String(s.capacity),
      room: s.room ?? "",
      description: s.description ?? "",
      status: s.status,
    });
    setEditSession(s);
  }

  function setEdit(field: string, value: string | boolean) {
    setEditForm((f) => ({ ...f, [field]: value }));
  }

  // ── Submit: add class ───────────────────────────────────────────────────────

  async function submitAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!addForm.title.trim()) { toast.error("Class name is required"); return; }
    if (!addForm.categoryId) { toast.error("Select a category"); return; }

    const nameEntered = addForm.instructorName.trim();
    if (!nameEntered) { toast.error("Instructor name is required"); return; }
    const matchedInstructor = instructors.find(
      (i) => i.fullName.toLowerCase() === nameEntered.toLowerCase()
    );
    if (instructors.length > 0 && !matchedInstructor) {
      toast.error(`No instructor profile found for "${nameEntered}".`);
      return;
    }
    if (instructors.length === 0) {
      toast.error("No instructor profiles exist. Create an instructor account first.");
      return;
    }
    const instructorId = matchedInstructor!.id;

    setSaving(true);
    try {
      const cat = categories.find((c) => c.id === addForm.categoryId)!;
      const weeksToCreate = addForm.isRecurring ? Math.max(1, Number(addForm.repeatWeeks)) : 1;
      const newSessions: Session[] = [];
      let lastError = "";

      for (let week = 0; week < weeksToCreate; week++) {
        const baseDate = new Date(`${addForm.date}T${addForm.startTime}:00`);
        const startISO = addDays(baseDate, week * 7).toISOString();

        const res = await fetch("/api/classes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: addForm.title.trim(),
            categoryId: addForm.categoryId,
            instructorId,
            startTime: startISO,
            durationMins: Number(addForm.durationMins),
            capacity: Number(addForm.capacity),
            room: addForm.room.trim() || null,
            isWorkshop: addForm.isWorkshop,
            workshopPrice: addForm.isWorkshop && addForm.workshopPrice ? Number(addForm.workshopPrice) : null,
            usesCredits: addForm.usesCredits,
            description: addForm.description.trim() || null,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          lastError = data.error ?? "Failed to create class";
          continue;
        }

        newSessions.push({
          id: data.id,
          title: data.title,
          startTime: data.startTime,
          endTime: data.endTime,
          durationMins: data.durationMins,
          capacity: data.capacity,
          bookedCount: 0,
          waitlistCount: 0,
          spotsLeft: data.capacity,
          isFull: false,
          room: data.room,
          status: "scheduled",
          isWorkshop: data.isWorkshop,
          description: data.description,
          category: { name: cat.name, color: cat.color },
          instructor: { id: matchedInstructor!.id, fullName: matchedInstructor!.fullName },
          substituteInstructor: null,
        });
      }

      if (newSessions.length > 0) {
        setSessions((prev) => [...prev, ...newSessions]);
        const msg = addForm.isRecurring
          ? `"${addForm.title}" added for ${newSessions.length} week${newSessions.length !== 1 ? "s" : ""}`
          : `"${addForm.title}" added to schedule`;
        toast.success(msg);
        if (lastError && newSessions.length < weeksToCreate) {
          toast.error(`${weeksToCreate - newSessions.length} week(s) skipped: ${lastError}`);
        }
        setShowAddForm(false);
      } else {
        toast.error(lastError || "Failed to create class");
      }
    } finally {
      setSaving(false);
    }
  }

  // ── Submit: edit class ──────────────────────────────────────────────────────

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editSession) return;

    const nameEntered = editForm.instructorName.trim();
    const matchedInstructor = instructors.find(
      (i) => i.fullName.toLowerCase() === nameEntered.toLowerCase()
    );
    if (instructors.length > 0 && !matchedInstructor) {
      toast.error(`No instructor profile found for "${nameEntered}".`);
      return;
    }

    setSaving(true);
    try {
      const startISO = new Date(`${editForm.date}T${editForm.startTime}:00`).toISOString();
      const res = await fetch(`/api/classes/${editSession.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editForm.title.trim(),
          categoryId: editForm.categoryId,
          instructorId: matchedInstructor?.id ?? editSession.instructor.id,
          startTime: startISO,
          durationMins: Number(editForm.durationMins),
          capacity: Number(editForm.capacity),
          room: editForm.room.trim() || null,
          description: editForm.description.trim() || null,
          status: editForm.status,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to update class");
        return;
      }

      const cat = categories.find((c) => c.id === editForm.categoryId) ?? editSession.category as { id: string; name: string; color: string };
      const instructor = matchedInstructor ?? editSession.instructor;

      setSessions((prev) =>
        prev.map((s) =>
          s.id === editSession.id
            ? {
                ...s,
                title: editForm.title.trim(),
                startTime: data.startTime ?? startISO,
                endTime: data.endTime ?? s.endTime,
                durationMins: Number(editForm.durationMins),
                capacity: Number(editForm.capacity),
                room: editForm.room.trim() || null,
                description: editForm.description.trim() || null,
                status: editForm.status,
                category: { name: cat.name, color: cat.color },
                instructor: { id: instructor.id, fullName: instructor.fullName },
              }
            : s
        )
      );
      toast.success("Class updated");
      setEditSession(null);
    } finally {
      setSaving(false);
    }
  }

  // ── Cancel class ────────────────────────────────────────────────────────────

  async function cancelClass(sessionId: string) {
    const reason = prompt("Reason for cancellation?");
    if (reason === null) return;
    const res = await fetch(`/api/classes/${sessionId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    if (res.ok) {
      toast.success("Class cancelled. All clients notified.");
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } else {
      const { error } = await res.json();
      toast.error(error ?? "Failed to cancel class");
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Top bar: nav + view toggle */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon-sm" onClick={() => setWeekStart(addDays(weekStart, -7))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium text-stone-600 min-w-[160px] text-center">
            {format(weekStart, "d MMM")} – {format(addDays(weekStart, 6), "d MMM yyyy")}
          </span>
          <Button variant="outline" size="icon-sm" onClick={() => setWeekStart(addDays(weekStart, 7))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <button
            onClick={() => setWeekStart(startOfDay(new Date()))}
            className="text-xs text-sage-600 hover:underline ml-1"
          >
            Today
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex bg-stone-100 p-1 rounded-xl gap-0.5">
            <button
              onClick={() => setView("list")}
              className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all", view === "list" ? "bg-white shadow-card text-stone-900" : "text-stone-500 hover:text-stone-700")}
            >
              <List className="h-3.5 w-3.5" /> List
            </button>
            <button
              onClick={() => setView("week")}
              className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all", view === "week" ? "bg-white shadow-card text-stone-900" : "text-stone-500 hover:text-stone-700")}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Week
            </button>
          </div>
          <Button size="sm" onClick={openAddForm}>
            <Plus className="h-4 w-4" />
            Add Class
          </Button>
        </div>
      </div>

      {/* Day tabs */}
      <div className="flex gap-1 bg-stone-100 p-1 rounded-xl overflow-x-auto">
        {days.map((day, i) => {
          const count = sessions.filter((s) => isSameDay(new Date(s.startTime), day)).length;
          const isToday = isSameDay(day, new Date());
          return (
            <button
              key={i}
              onClick={() => setSelectedDay(i)}
              className={cn(
                "flex flex-col items-center px-3 py-2 rounded-lg flex-1 min-w-[52px] transition-all",
                selectedDay === i ? "bg-white shadow-card text-stone-900" : "text-stone-500 hover:text-stone-700"
              )}
            >
              <span className="text-[10px] font-medium">{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][day.getDay()]}</span>
              <span className={cn("text-base font-bold leading-none mt-0.5", isToday && selectedDay !== i && "text-sage-500")}>
                {format(day, "d")}
              </span>
              {count > 0 && <span className="mt-1 w-1.5 h-1.5 rounded-full bg-sage-400" />}
            </button>
          );
        })}
      </div>

      {view === "list" ? (
        <ListView
          sessions={daySessions}
          selectedDate={selectedDate}
          onAdd={openAddForm}
          onEdit={openEdit}
          onCancel={cancelClass}
        />
      ) : (
        <WeekGridView
          sessions={sessions}
          days={days}
          onEdit={openEdit}
          onAdd={openAddForm}
        />
      )}

      {/* ── Add Class Modal ───────────────────────────────────────────────── */}
      {showAddForm && (
        <ClassFormModal
          title="Add Class"
          onClose={() => setShowAddForm(false)}
          onSubmit={submitAdd}
          saving={saving}
          categories={categories}
          instructors={instructors}
          form={addForm}
          setField={setAdd}
          showRecurring
        />
      )}

      {/* ── Edit Class Modal ──────────────────────────────────────────────── */}
      {editSession && (
        <ClassFormModal
          title="Edit Class"
          onClose={() => setEditSession(null)}
          onSubmit={submitEdit}
          saving={saving}
          categories={categories}
          instructors={instructors}
          form={editForm}
          setField={setEdit}
          showStatus
        />
      )}
    </div>
  );
}

// ─── List View ────────────────────────────────────────────────────────────────

function ListView({
  sessions,
  selectedDate,
  onAdd,
  onEdit,
  onCancel,
}: {
  sessions: Session[];
  selectedDate: Date;
  onAdd: () => void;
  onEdit: (s: Session) => void;
  onCancel: (id: string) => void;
}) {
  const sorted = [...sessions].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-sm font-medium text-stone-600">
          {format(selectedDate, "EEEE, d MMMM")} · {sessions.length} class{sessions.length !== 1 ? "es" : ""}
        </h2>
      </div>

      {sorted.length === 0 ? (
        <div className="text-center py-12 text-stone-400">
          <Clock className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No classes scheduled for this day</p>
          <button onClick={onAdd} className="mt-2 text-xs text-sage-600 hover:underline">
            + Add the first class
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((s) => (
            <SessionCard key={s.id} session={s} onEdit={onEdit} onCancel={onCancel} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Session Card ─────────────────────────────────────────────────────────────

function SessionCard({
  session: s,
  onEdit,
  onCancel,
}: {
  session: Session;
  onEdit: (s: Session) => void;
  onCancel: (id: string) => void;
}) {
  return (
    <Card className="p-4">
      <div className="flex gap-3">
        <div className="w-1 rounded-full flex-shrink-0 self-stretch" style={{ backgroundColor: s.category.color }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-stone-900 leading-snug">{s.title}</p>
              <p className="text-xs text-stone-500 mt-0.5">
                {s.category.name}
                {s.isWorkshop && <span className="ml-1 text-amber-600">· Workshop</span>}
              </p>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", occupancyColor(s.bookedCount, s.capacity))}>
                {s.bookedCount}/{s.capacity}
              </span>
              <button
                onClick={() => onEdit(s)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-sage-600 hover:bg-sage-50 transition-colors"
                title="Edit class"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-stone-500">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatTime(s.startTime)} – {formatTime(s.endTime)}
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {s.substituteInstructor ? `${s.substituteInstructor.fullName} (sub)` : s.instructor.fullName}
            </span>
            {s.room && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {s.room}
              </span>
            )}
            {s.waitlistCount > 0 && <Badge variant="warning">+{s.waitlistCount} waitlist</Badge>}
          </div>
          <div className="mt-3 flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-red-500 hover:text-red-600 hover:bg-red-50"
              onClick={() => onCancel(s.id)}
            >
              Cancel Class
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ─── Week Grid View ───────────────────────────────────────────────────────────

function WeekGridView({
  sessions,
  days,
  onEdit,
  onAdd,
}: {
  sessions: Session[];
  days: Date[];
  onEdit: (s: Session) => void;
  onAdd: () => void;
}) {
  const hours = Array.from({ length: TOTAL_HOURS }, (_, i) => GRID_START_HOUR + i);
  const totalHeight = TOTAL_HOURS * HOUR_PX;

  return (
    <div className="overflow-x-auto rounded-2xl border border-stone-100 bg-white">
      {/* Day column headers */}
      <div className="grid border-b border-stone-100" style={{ gridTemplateColumns: "56px repeat(7, 1fr)" }}>
        <div className="border-r border-stone-100" />
        {days.map((day, i) => {
          const isToday = isSameDay(day, new Date());
          const count = sessions.filter((s) => isSameDay(new Date(s.startTime), day)).length;
          return (
            <div
              key={i}
              className={cn("py-3 px-2 text-center border-r border-stone-100 last:border-r-0", isToday && "bg-sage-50")}
            >
              <p className="text-[10px] font-medium text-stone-400 uppercase">{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][day.getDay()]}</p>
              <p className={cn("text-sm font-bold mt-0.5", isToday ? "text-sage-700" : "text-stone-700")}>{format(day, "d")}</p>
              {count > 0 && <p className="text-[10px] text-stone-400 mt-0.5">{count} class{count !== 1 ? "es" : ""}</p>}
            </div>
          );
        })}
      </div>

      {/* Time grid body */}
      <div className="relative flex" style={{ height: totalHeight }}>
        {/* Hour labels */}
        <div className="w-14 flex-shrink-0 border-r border-stone-100 relative">
          {hours.map((h) => (
            <div
              key={h}
              className="absolute w-full flex items-start justify-end pr-2"
              style={{ top: (h - GRID_START_HOUR) * HOUR_PX - 8 }}
            >
              <span className="text-[10px] text-stone-400 font-medium">
                {h === 12 ? "12pm" : h > 12 ? `${h - 12}pm` : `${h}am`}
              </span>
            </div>
          ))}
        </div>

        {/* Day columns */}
        {days.map((day, di) => {
          const daySessions = sessions.filter((s) => isSameDay(new Date(s.startTime), day));
          const isToday = isSameDay(day, new Date());

          return (
            <div
              key={di}
              className={cn("flex-1 border-r border-stone-100 last:border-r-0 relative", isToday && "bg-sage-50/40")}
              style={{ minWidth: "120px" }}
            >
              {/* Hour grid lines */}
              {hours.map((h) => (
                <div
                  key={h}
                  className="absolute w-full border-t border-stone-100"
                  style={{ top: (h - GRID_START_HOUR) * HOUR_PX }}
                />
              ))}

              {/* Session blocks */}
              {daySessions.map((s) => {
                const start = new Date(s.startTime);
                const topPx = timeToOffset(start);
                const heightPx = Math.max(s.durationMins, 20) * (HOUR_PX / 60);
                const color = s.category.color;

                return (
                  <button
                    key={s.id}
                    onClick={() => onEdit(s)}
                    className="absolute left-1 right-1 rounded-lg px-2 py-1 text-left overflow-hidden group hover:opacity-90 transition-opacity"
                    style={{
                      top: topPx + 1,
                      height: heightPx - 2,
                      backgroundColor: hexToRgba(color, 0.15),
                      borderLeft: `3px solid ${color}`,
                    }}
                    title={`${s.title} — ${formatTime(s.startTime)}`}
                  >
                    <p className="text-[11px] font-semibold leading-tight truncate" style={{ color }}>
                      {s.title}
                    </p>
                    {heightPx > 36 && (
                      <p className="text-[10px] leading-tight text-stone-500 truncate">
                        {formatTime(s.startTime)} · {s.instructor.fullName.split(" ")[0]}
                      </p>
                    )}
                    {heightPx > 52 && (
                      <p className="text-[10px] text-stone-400">{s.bookedCount}/{s.capacity}</p>
                    )}
                    <Pencil className="absolute top-1 right-1 h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity" style={{ color }} />
                  </button>
                );
              })}

              {/* Click-to-add hint when day is empty */}
              {daySessions.length === 0 && (
                <button
                  onClick={onAdd}
                  className="absolute inset-0 w-full h-full opacity-0 hover:opacity-100 flex items-center justify-center text-xs text-stone-400 hover:text-sage-500 transition-opacity"
                >
                  <Plus className="h-4 w-4" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Shared Modal Form ────────────────────────────────────────────────────────

interface FormState {
  title: string;
  categoryId: string;
  instructorName: string;
  date: string;
  startTime: string;
  durationMins: string;
  capacity: string;
  room: string;
  description: string;
  isWorkshop?: boolean;
  workshopPrice?: string;
  usesCredits?: boolean;
  isRecurring?: boolean;
  repeatWeeks?: string;
  status?: string;
}

function ClassFormModal({
  title,
  onClose,
  onSubmit,
  saving,
  categories,
  instructors,
  form,
  setField,
  showRecurring,
  showStatus,
}: {
  title: string;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => Promise<void>;
  saving: boolean;
  categories: { id: string; name: string; color: string }[];
  instructors: { id: string; fullName: string }[];
  form: FormState;
  setField: (field: string, value: string | boolean) => void;
  showRecurring?: boolean;
  showStatus?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
          <h2 className="text-base font-semibold text-stone-900">{title}</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="px-6 py-5 space-y-4">
          {/* Class Name */}
          <div>
            <label className={labelCls}>Class Name *</label>
            <input
              className={inputCls}
              placeholder="e.g. Morning Flow Yoga"
              value={form.title}
              onChange={(e) => setField("title", e.target.value)}
              required
            />
          </div>

          {/* Category */}
          <div>
            <label className={labelCls}>Category *</label>
            <select className={inputCls} value={form.categoryId} onChange={(e) => setField("categoryId", e.target.value)} required>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Instructor */}
          <div>
            <label className={labelCls}>Instructor *</label>
            <input
              list="instructor-suggestions-modal"
              className={inputCls}
              placeholder="Type instructor name…"
              value={form.instructorName}
              onChange={(e) => setField("instructorName", e.target.value)}
              autoComplete="off"
              required
            />
            <datalist id="instructor-suggestions-modal">
              {instructors.map((i) => (
                <option key={i.id} value={i.fullName} />
              ))}
            </datalist>
            {instructors.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">No instructor profiles — create one first.</p>
            )}
          </div>

          {/* Date + Start Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Date *</label>
              <input type="date" className={inputCls} value={form.date} onChange={(e) => setField("date", e.target.value)} required />
            </div>
            <div>
              <label className={labelCls}>Start Time *</label>
              <input type="time" className={inputCls} value={form.startTime} onChange={(e) => setField("startTime", e.target.value)} required />
            </div>
          </div>

          {/* Duration + Capacity */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Duration (minutes) *</label>
              <select className={inputCls} value={form.durationMins} onChange={(e) => setField("durationMins", e.target.value)}>
                <option value="30">30 min</option>
                <option value="45">45 min</option>
                <option value="60">60 min</option>
                <option value="75">75 min</option>
                <option value="90">90 min</option>
                <option value="120">120 min</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Max Capacity *</label>
              <input type="number" min="1" max="50" className={inputCls} value={form.capacity} onChange={(e) => setField("capacity", e.target.value)} required />
            </div>
          </div>

          {/* Room */}
          <div>
            <label className={labelCls}>Room / Location <span className="text-stone-400">(optional)</span></label>
            <input className={inputCls} placeholder="e.g. Studio 1" value={form.room} onChange={(e) => setField("room", e.target.value)} />
          </div>

          {/* Description */}
          <div>
            <label className={labelCls}>Description <span className="text-stone-400">(optional)</span></label>
            <textarea
              className={cn(inputCls, "resize-none")}
              rows={2}
              placeholder="Brief description"
              value={form.description}
              onChange={(e) => setField("description", e.target.value)}
            />
          </div>

          {/* Status (edit only) */}
          {showStatus && (
            <div>
              <label className={labelCls}>Status</label>
              <select className={inputCls} value={form.status ?? "scheduled"} onChange={(e) => setField("status", e.target.value)}>
                <option value="scheduled">Scheduled</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          )}

          {/* Recurring (add only) */}
          {showRecurring && (
            <div className="rounded-xl border border-stone-200 p-4 space-y-3 bg-stone-50">
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-stone-500" />
                  <div>
                    <p className="text-sm font-medium text-stone-700">Recurring (weekly)</p>
                    <p className="text-xs text-stone-400">Auto-create this class every week</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setField("isRecurring", !form.isRecurring)}
                  className={cn("relative inline-flex h-6 w-11 items-center rounded-full transition-colors", form.isRecurring ? "bg-sage-500" : "bg-stone-200")}
                >
                  <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform", form.isRecurring ? "translate-x-6" : "translate-x-1")} />
                </button>
              </label>
              {form.isRecurring && (
                <div>
                  <label className={labelCls}>Repeat for how many weeks?</label>
                  <select className={inputCls} value={form.repeatWeeks} onChange={(e) => setField("repeatWeeks", e.target.value)}>
                    {[2,3,4,6,8,10,12].map((w) => (
                      <option key={w} value={String(w)}>{w} weeks</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Toggles (add only) */}
          {showRecurring && (
            <div className="space-y-3 pt-1">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <p className="text-sm font-medium text-stone-700">Requires credit</p>
                  <p className="text-xs text-stone-400">Deducts 1 credit from client's package</p>
                </div>
                <button
                  type="button"
                  onClick={() => setField("usesCredits", !form.usesCredits)}
                  className={cn("relative inline-flex h-6 w-11 items-center rounded-full transition-colors", form.usesCredits ? "bg-sage-500" : "bg-stone-200")}
                >
                  <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform", form.usesCredits ? "translate-x-6" : "translate-x-1")} />
                </button>
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <p className="text-sm font-medium text-stone-700">Workshop / Special event</p>
                  <p className="text-xs text-stone-400">Has a separate cash price</p>
                </div>
                <button
                  type="button"
                  onClick={() => setField("isWorkshop", !form.isWorkshop)}
                  className={cn("relative inline-flex h-6 w-11 items-center rounded-full transition-colors", form.isWorkshop ? "bg-amber-500" : "bg-stone-200")}
                >
                  <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform", form.isWorkshop ? "translate-x-6" : "translate-x-1")} />
                </button>
              </label>
              {form.isWorkshop && (
                <div>
                  <label className={labelCls}>Workshop Price (PKR) *</label>
                  <input type="number" min="0" className={inputCls} placeholder="e.g. 3500" value={form.workshopPrice} onChange={(e) => setField("workshopPrice", e.target.value)} />
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2 border-t border-stone-100">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="flex-1" loading={saving}>
              {saving ? "Saving…" : title === "Edit Class" ? "Save Changes" : "Add to Schedule"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

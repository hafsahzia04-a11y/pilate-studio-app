"use client";

import { useState } from "react";
import { format, addDays, startOfDay, isSameDay } from "date-fns";
import { cn, formatTime, occupancyColor } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Users, Clock, MapPin, ChevronLeft, ChevronRight, X } from "lucide-react";
import toast from "react-hot-toast";

interface Session {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  capacity: number;
  bookedCount: number;
  waitlistCount: number;
  spotsLeft: number;
  isFull: boolean;
  room?: string | null;
  status: string;
  isWorkshop: boolean;
  category: { name: string; color: string };
  instructor: { id: string; fullName: string };
  substituteInstructor?: { id: string; fullName: string } | null;
}

interface ScheduleViewProps {
  sessions: Session[];
  instructors: { id: string; fullName: string }[];
  categories: { id: string; name: string; color: string }[];
}

const inputCls = "w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 outline-none focus:border-sage-400 focus:ring-2 focus:ring-sage-100";
const labelCls = "block text-xs font-medium text-stone-600 mb-1";

export function ScheduleView({ sessions: initialSessions, instructors, categories }: ScheduleViewProps) {
  const [sessions, setSessions] = useState(initialSessions);
  const [weekStart, setWeekStart] = useState(startOfDay(new Date()));
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const [selectedDay, setSelectedDay] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectedDate = days[selectedDay];
  const daySessions = sessions.filter((s) =>
    isSameDay(new Date(s.startTime), selectedDate)
  );

  const defaultDate = format(selectedDate, "yyyy-MM-dd");

  const [form, setForm] = useState({
    title: "",
    categoryId: categories[0]?.id ?? "",
    instructorId: instructors[0]?.id ?? "",
    date: defaultDate,
    startTime: "09:00",
    durationMins: "60",
    capacity: "12",
    room: "",
    isWorkshop: false,
    workshopPrice: "",
    usesCredits: true,
    description: "",
  });

  function openForm() {
    setForm((f) => ({ ...f, date: format(selectedDate, "yyyy-MM-dd") }));
    setShowForm(true);
  }

  function set(field: string, value: string | boolean) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { toast.error("Class name is required"); return; }
    if (!form.instructorId) { toast.error("Select an instructor"); return; }
    if (!form.categoryId) { toast.error("Select a category"); return; }

    setSaving(true);
    try {
      const startISO = new Date(`${form.date}T${form.startTime}:00`).toISOString();
      const res = await fetch("/api/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          categoryId: form.categoryId,
          instructorId: form.instructorId,
          startTime: startISO,
          durationMins: Number(form.durationMins),
          capacity: Number(form.capacity),
          room: form.room.trim() || null,
          isWorkshop: form.isWorkshop,
          workshopPrice: form.isWorkshop && form.workshopPrice ? Number(form.workshopPrice) : null,
          usesCredits: form.usesCredits,
          description: form.description.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Failed to create class"); return; }

      toast.success(`"${form.title}" added to schedule`);
      setShowForm(false);

      // Optimistically add to view
      const cat = categories.find((c) => c.id === form.categoryId)!;
      const inst = instructors.find((i) => i.id === form.instructorId)!;
      setSessions((prev) => [
        ...prev,
        {
          id: data.id,
          title: data.title,
          startTime: data.startTime,
          endTime: data.endTime,
          capacity: data.capacity,
          bookedCount: 0,
          waitlistCount: 0,
          spotsLeft: data.capacity,
          isFull: false,
          room: data.room,
          status: "scheduled",
          isWorkshop: data.isWorkshop,
          category: { name: cat.name, color: cat.color },
          instructor: { id: inst.id, fullName: inst.fullName },
          substituteInstructor: null,
        },
      ]);
    } finally {
      setSaving(false);
    }
  }

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

  return (
    <div className="space-y-4">
      {/* Week navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="icon-sm" onClick={() => setWeekStart(addDays(weekStart, -7))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium text-stone-600">
          {format(weekStart, "d MMM")} – {format(addDays(weekStart, 6), "d MMM yyyy")}
        </span>
        <Button variant="outline" size="icon-sm" onClick={() => setWeekStart(addDays(weekStart, 7))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
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

      {/* Header + Add button */}
      <div className="flex justify-between items-center">
        <h2 className="text-sm font-medium text-stone-600">
          {format(selectedDate, "EEEE, d MMMM")} · {daySessions.length} class{daySessions.length !== 1 ? "es" : ""}
        </h2>
        <Button size="sm" onClick={openForm}>
          <Plus className="h-4 w-4" />
          Add Class
        </Button>
      </div>

      {/* Sessions list */}
      {daySessions.length === 0 ? (
        <div className="text-center py-12 text-stone-400">
          <Clock className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No classes scheduled for this day</p>
          <button onClick={openForm} className="mt-2 text-xs text-sage-600 hover:underline">
            + Add the first class
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {daySessions
            .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
            .map((session) => (
            <Card key={session.id} className="p-4">
              <div className="flex gap-3">
                <div className="w-1 rounded-full flex-shrink-0 self-stretch" style={{ backgroundColor: session.category.color }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-stone-900 leading-snug">{session.title}</p>
                      <p className="text-xs text-stone-500 mt-0.5">
                        {session.category.name}
                        {session.isWorkshop && <span className="ml-1 text-amber-600">· Workshop</span>}
                      </p>
                    </div>
                    <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", occupancyColor(session.bookedCount, session.capacity))}>
                      {session.bookedCount}/{session.capacity}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-stone-500">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatTime(session.startTime)} – {formatTime(session.endTime)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {session.substituteInstructor
                        ? `${session.substituteInstructor.fullName} (sub)`
                        : session.instructor.fullName}
                    </span>
                    {session.room && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {session.room}
                      </span>
                    )}
                    {session.waitlistCount > 0 && <Badge variant="warning">+{session.waitlistCount} waitlist</Badge>}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-600 hover:bg-red-50"
                      onClick={() => cancelClass(session.id)}
                    >
                      Cancel Class
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ── Add Class Modal ─────────────────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
              <h2 className="text-base font-semibold text-stone-900">Add Class</h2>
              <button onClick={() => setShowForm(false)} className="text-stone-400 hover:text-stone-600 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={submitForm} className="px-6 py-5 space-y-4">
              {/* Class name */}
              <div>
                <label className={labelCls}>Class Name *</label>
                <input
                  className={inputCls}
                  placeholder="e.g. Morning Flow Yoga"
                  value={form.title}
                  onChange={(e) => set("title", e.target.value)}
                  required
                />
              </div>

              {/* Category */}
              <div>
                <label className={labelCls}>Category *</label>
                <select className={inputCls} value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)} required>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Instructor */}
              <div>
                <label className={labelCls}>Instructor *</label>
                {instructors.length === 0 ? (
                  <p className="text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">
                    No instructors found. Create an instructor account first via Supabase Auth, then add their profile with role = instructor.
                  </p>
                ) : (
                  <select className={inputCls} value={form.instructorId} onChange={(e) => set("instructorId", e.target.value)} required>
                    {instructors.map((i) => (
                      <option key={i.id} value={i.id}>{i.fullName}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Date + Start time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Date *</label>
                  <input
                    type="date"
                    className={inputCls}
                    value={form.date}
                    onChange={(e) => set("date", e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className={labelCls}>Start Time *</label>
                  <input
                    type="time"
                    className={inputCls}
                    value={form.startTime}
                    onChange={(e) => set("startTime", e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Duration + Capacity */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Duration (minutes) *</label>
                  <select className={inputCls} value={form.durationMins} onChange={(e) => set("durationMins", e.target.value)}>
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
                  <input
                    type="number"
                    min="1"
                    max="50"
                    className={inputCls}
                    value={form.capacity}
                    onChange={(e) => set("capacity", e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Room */}
              <div>
                <label className={labelCls}>Room / Location <span className="text-stone-400">(optional)</span></label>
                <input
                  className={inputCls}
                  placeholder="e.g. Studio 1, Main Hall"
                  value={form.room}
                  onChange={(e) => set("room", e.target.value)}
                />
              </div>

              {/* Description */}
              <div>
                <label className={labelCls}>Description <span className="text-stone-400">(optional)</span></label>
                <textarea
                  className={cn(inputCls, "resize-none")}
                  rows={2}
                  placeholder="Brief description shown to clients"
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                />
              </div>

              {/* Toggles */}
              <div className="space-y-3 pt-1">
                {/* Uses credits */}
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <p className="text-sm font-medium text-stone-700">Requires credit</p>
                    <p className="text-xs text-stone-400">Deducts 1 credit from client's package</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => set("usesCredits", !form.usesCredits)}
                    className={cn(
                      "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                      form.usesCredits ? "bg-sage-500" : "bg-stone-200"
                    )}
                  >
                    <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform", form.usesCredits ? "translate-x-6" : "translate-x-1")} />
                  </button>
                </label>

                {/* Is workshop */}
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <p className="text-sm font-medium text-stone-700">Workshop / Special event</p>
                    <p className="text-xs text-stone-400">Has a separate cash price, workshop discounts apply</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => set("isWorkshop", !form.isWorkshop)}
                    className={cn(
                      "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                      form.isWorkshop ? "bg-amber-500" : "bg-stone-200"
                    )}
                  >
                    <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform", form.isWorkshop ? "translate-x-6" : "translate-x-1")} />
                  </button>
                </label>

                {/* Workshop price */}
                {form.isWorkshop && (
                  <div>
                    <label className={labelCls}>Workshop Price (PKR) *</label>
                    <input
                      type="number"
                      min="0"
                      className={inputCls}
                      placeholder="e.g. 3500"
                      value={form.workshopPrice}
                      onChange={(e) => set("workshopPrice", e.target.value)}
                    />
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2 border-t border-stone-100">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" loading={saving}>
                  {saving ? "Saving…" : "Add to Schedule"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

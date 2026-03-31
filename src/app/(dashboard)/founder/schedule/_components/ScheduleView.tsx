"use client";

import { useState } from "react";
import { format, addDays, startOfDay, isSameDay } from "date-fns";
import { cn, formatTime, occupancyColor } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Users, Clock, MapPin, ChevronLeft, ChevronRight } from "lucide-react";
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

export function ScheduleView({ sessions, instructors, categories }: ScheduleViewProps) {
  const [weekStart, setWeekStart] = useState(startOfDay(new Date()));
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const [selectedDay, setSelectedDay] = useState(0);

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const selectedDate = days[selectedDay];
  const daySessions = sessions.filter((s) =>
    isSameDay(new Date(s.startTime), selectedDate)
  );

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
      window.location.reload();
    } else {
      const { error } = await res.json();
      toast.error(error ?? "Failed to cancel class");
    }
  }

  return (
    <div className="space-y-4">
      {/* Week navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => setWeekStart(addDays(weekStart, -7))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium text-stone-600">
          {format(weekStart, "d MMM")} – {format(addDays(weekStart, 6), "d MMM yyyy")}
        </span>
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => setWeekStart(addDays(weekStart, 7))}
        >
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
                selectedDay === i
                  ? "bg-white shadow-card text-stone-900"
                  : "text-stone-500 hover:text-stone-700"
              )}
            >
              <span className="text-[10px] font-medium">{dayNames[day.getDay()]}</span>
              <span
                className={cn(
                  "text-base font-bold leading-none mt-0.5",
                  isToday && selectedDay !== i && "text-sage-500"
                )}
              >
                {format(day, "d")}
              </span>
              {count > 0 && (
                <span className="mt-1 w-1.5 h-1.5 rounded-full bg-sage-400" />
              )}
            </button>
          );
        })}
      </div>

      {/* Add class button */}
      <div className="flex justify-between items-center">
        <h2 className="text-sm font-medium text-stone-600">
          {format(selectedDate, "EEEE, d MMMM")} · {daySessions.length} class{daySessions.length !== 1 ? "es" : ""}
        </h2>
        <Button size="sm" onClick={() => toast("Use the Add Class form — coming next!")}>
          <Plus className="h-4 w-4" />
          Add Class
        </Button>
      </div>

      {/* Sessions */}
      {daySessions.length === 0 ? (
        <div className="text-center py-12 text-stone-400">
          <Clock className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No classes scheduled for this day</p>
        </div>
      ) : (
        <div className="space-y-3">
          {daySessions.map((session) => (
            <Card key={session.id} className="p-4">
              <div className="flex gap-3">
                {/* Category colour bar */}
                <div
                  className="w-1 rounded-full flex-shrink-0 self-stretch"
                  style={{ backgroundColor: session.category.color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-stone-900 leading-snug">
                        {session.title}
                      </p>
                      <p className="text-xs text-stone-500 mt-0.5">
                        {session.category.name}
                        {session.isWorkshop && (
                          <span className="ml-1 text-amber-600">· Workshop</span>
                        )}
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      <span
                        className={cn(
                          "text-xs font-medium px-2 py-0.5 rounded-full",
                          occupancyColor(session.bookedCount, session.capacity)
                        )}
                      >
                        {session.bookedCount}/{session.capacity}
                      </span>
                    </div>
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
                    {session.waitlistCount > 0 && (
                      <Badge variant="warning">
                        +{session.waitlistCount} waitlist
                      </Badge>
                    )}
                  </div>

                  <div className="mt-3 flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(`/api/classes/${session.id}`, "_blank")}
                    >
                      View Roster
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-600 hover:bg-red-50"
                      onClick={() => cancelClass(session.id)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

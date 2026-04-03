"use client";

import { ArrowLeft, ArrowRight, Calendar, Clock, Users, MapPin, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, formatDate, formatTime, occupancyColor } from "@/lib/utils";
import type { SessionForPicker } from "./RegistrationWizard";
import { format } from "date-fns";

interface Props {
  sessions: SessionForPicker[];
  selectedSessions: SessionForPicker[];
  onSelectSessions: (sessions: SessionForPicker[]) => void;
  maxCredits: number;
  onNext: () => void;
  onBack: () => void;
}

function groupByDate(sessions: SessionForPicker[]): Record<string, SessionForPicker[]> {
  const groups: Record<string, SessionForPicker[]> = {};
  for (const s of sessions) {
    const key = format(new Date(s.startTime), "yyyy-MM-dd");
    if (!groups[key]) groups[key] = [];
    groups[key].push(s);
  }
  return groups;
}

export function Step3Schedule({
  sessions,
  selectedSessions,
  onSelectSessions,
  maxCredits,
  onNext,
  onBack,
}: Props) {
  const grouped = groupByDate(sessions);
  const dateKeys = Object.keys(grouped).sort();
  const selectedIds = new Set(selectedSessions.map((s) => s.id));
  const selectionCount = selectedSessions.length;

  function toggle(session: SessionForPicker) {
    if (selectedIds.has(session.id)) {
      onSelectSessions(selectedSessions.filter((s) => s.id !== session.id));
    } else {
      if (selectionCount >= maxCredits) return; // cap at package credits
      onSelectSessions([...selectedSessions, session]);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 mb-1">
        <Calendar className="h-5 w-5 text-sage-500" />
        <h2 className="text-base font-semibold text-stone-900">Select Classes</h2>
      </div>

      {/* Credit counter */}
      <div className="flex items-center justify-between rounded-xl bg-stone-50 border border-stone-200 px-4 py-3">
        <p className="text-sm text-stone-600">
          Classes selected: <span className="font-bold text-stone-900">{selectionCount}</span>
          <span className="text-stone-400"> / {maxCredits} included in package</span>
        </p>
        {selectionCount >= maxCredits && (
          <span className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded-lg">
            <AlertCircle className="h-3 w-3" />
            Limit reached
          </span>
        )}
      </div>

      <p className="text-xs text-stone-500">
        Showing the next 14 days. You can always add more bookings from the client profile later.
      </p>

      {sessions.length === 0 && (
        <div className="text-center py-10 text-stone-400 text-sm">
          No upcoming classes scheduled in the next 14 days.
        </div>
      )}

      {/* Grouped sessions */}
      <div className="space-y-5">
        {dateKeys.map((dateKey) => {
          const daySessions = grouped[dateKey];
          const dateObj = new Date(dateKey + "T12:00:00");
          return (
            <div key={dateKey}>
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">
                {format(dateObj, "EEEE, d MMMM")}
              </p>
              <div className="space-y-2">
                {daySessions.map((session) => {
                  const isSelected = selectedIds.has(session.id);
                  const isDisabled =
                    (session.isFull && !isSelected) ||
                    (selectionCount >= maxCredits && !isSelected);

                  return (
                    <button
                      key={session.id}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => toggle(session)}
                      className={cn(
                        "w-full text-left rounded-xl border-2 px-4 py-3 transition-all",
                        isSelected
                          ? "border-sage-500 bg-sage-50"
                          : isDisabled
                          ? "border-stone-100 bg-stone-50 opacity-60 cursor-not-allowed"
                          : "border-stone-200 bg-white hover:border-sage-300"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        {/* Category color bar */}
                        <div
                          className="w-1 rounded-full self-stretch flex-shrink-0 mt-0.5"
                          style={{ backgroundColor: session.category.color }}
                        />

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-medium text-stone-800 text-sm truncate">
                              {session.title}
                            </p>
                            {/* Occupancy */}
                            <span
                              className={cn(
                                "text-xs font-medium px-2 py-0.5 rounded-lg flex-shrink-0",
                                occupancyColor(session.bookedCount, session.capacity)
                              )}
                            >
                              {session.bookedCount}/{session.capacity}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                            <span className="flex items-center gap-1 text-xs text-stone-500">
                              <Clock className="h-3 w-3" />
                              {formatTime(session.startTime)} · {session.durationMins}min
                            </span>
                            <span className="flex items-center gap-1 text-xs text-stone-500">
                              <Users className="h-3 w-3" />
                              {session.instructor.fullName}
                            </span>
                            {session.room && (
                              <span className="flex items-center gap-1 text-xs text-stone-500">
                                <MapPin className="h-3 w-3" />
                                {session.room}
                              </span>
                            )}
                          </div>

                          <div className="flex gap-1.5 mt-1.5">
                            <Badge variant="outline" className="text-xs py-0">
                              {session.category.name}
                            </Badge>
                            {session.isFull && (
                              <Badge variant="danger" className="text-xs py-0">Full</Badge>
                            )}
                            {!session.isFull && session.spotsLeft <= 3 && (
                              <Badge variant="warning" className="text-xs py-0">
                                {session.spotsLeft} spot{session.spotsLeft !== 1 ? "s" : ""} left
                              </Badge>
                            )}
                            {session.isWorkshop && (
                              <Badge variant="purple" className="text-xs py-0">Workshop</Badge>
                            )}
                          </div>
                        </div>

                        {/* Checkbox indicator */}
                        <div
                          className={cn(
                            "w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5",
                            isSelected ? "border-sage-500 bg-sage-500" : "border-stone-300"
                          )}
                        >
                          {isSelected && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Button onClick={onNext}>
          Next: Payment
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

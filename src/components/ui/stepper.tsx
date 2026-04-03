"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface StepperProps {
  steps: string[];
  current: number; // 1-based
  className?: string;
}

export function Stepper({ steps, current, className }: StepperProps) {
  return (
    <div className={cn("flex items-center w-full", className)}>
      {steps.map((label, index) => {
        const stepNum = index + 1;
        const isCompleted = stepNum < current;
        const isActive = stepNum === current;
        const isUpcoming = stepNum > current;

        return (
          <div key={label} className="flex items-center flex-1 last:flex-none">
            {/* Step circle + label */}
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all",
                  isCompleted && "bg-sage-500 text-white",
                  isActive && "bg-sage-600 text-white ring-4 ring-sage-100",
                  isUpcoming && "bg-stone-100 text-stone-400"
                )}
              >
                {isCompleted ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <span>{stepNum}</span>
                )}
              </div>
              <span
                className={cn(
                  "text-xs font-medium whitespace-nowrap hidden sm:block",
                  isCompleted && "text-sage-600",
                  isActive && "text-sage-700",
                  isUpcoming && "text-stone-400"
                )}
              >
                {label}
              </span>
            </div>

            {/* Connector line */}
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "flex-1 h-0.5 mx-2 mb-4 transition-all",
                  stepNum < current ? "bg-sage-400" : "bg-stone-200"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

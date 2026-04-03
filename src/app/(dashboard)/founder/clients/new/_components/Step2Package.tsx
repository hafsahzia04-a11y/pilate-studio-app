"use client";

import { ArrowLeft, ArrowRight, Package2, Check, Star, GraduationCap, Gift, Coffee, Percent, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency } from "@/lib/utils";
import type { PackageForPicker } from "./RegistrationWizard";

interface Props {
  packages: PackageForPicker[];
  selected: PackageForPicker | null;
  onSelect: (pkg: PackageForPicker) => void;
  onNext: () => void;
  onBack: () => void;
}

function packageTypeLabel(type: string): string {
  const map: Record<string, string> = {
    membership: "Monthly Membership",
    pack: "Class Pack",
    drop_in: "Drop-In",
    founding: "Founding Member",
  };
  return map[type] ?? type;
}

function packageTypeBadgeVariant(type: string) {
  if (type === "founding") return "founding" as const;
  if (type === "membership") return "sage" as const;
  if (type === "pack") return "blue" as const;
  return "default" as const;
}

export function Step2Package({ packages, selected, onSelect, onNext, onBack }: Props) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 mb-1">
        <Package2 className="h-5 w-5 text-sage-500" />
        <h2 className="text-base font-semibold text-stone-900">Select Package</h2>
      </div>
      <p className="text-sm text-stone-500">
        Choose the membership or class pack that this client is signing up for.
      </p>

      {packages.length === 0 && (
        <div className="text-center py-10 text-stone-400 text-sm">
          No active packages found. Create packages in the Packages section first.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {packages.map((pkg) => {
          const isSelected = selected?.id === pkg.id;
          return (
            <button
              key={pkg.id}
              type="button"
              onClick={() => onSelect(pkg)}
              className={cn(
                "relative text-left p-4 rounded-2xl border-2 transition-all",
                "hover:border-sage-400 hover:shadow-sm",
                isSelected
                  ? "border-sage-500 bg-sage-50 shadow-sm"
                  : "border-stone-200 bg-white"
              )}
            >
              {/* Selected checkmark */}
              {isSelected && (
                <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-sage-500 flex items-center justify-center">
                  <Check className="h-3.5 w-3.5 text-white" />
                </div>
              )}

              {/* Badges row */}
              <div className="flex flex-wrap gap-1.5 mb-2">
                <Badge variant={packageTypeBadgeVariant(pkg.type)}>
                  {packageTypeLabel(pkg.type)}
                </Badge>
                {pkg.isFounding && (
                  <Badge variant="founding">
                    <Star className="h-3 w-3 mr-1" />
                    Founding
                  </Badge>
                )}
                {pkg.requiresStudentId && (
                  <Badge variant="blue">
                    <GraduationCap className="h-3 w-3 mr-1" />
                    Student
                  </Badge>
                )}
              </div>

              {/* Name + price */}
              <p className="font-semibold text-stone-900 text-sm leading-tight">{pkg.name}</p>
              <p className="text-xl font-bold text-sage-700 mt-1">
                {formatCurrency(pkg.price)}
              </p>

              {/* Description */}
              {pkg.description && (
                <p className="text-xs text-stone-500 mt-1 line-clamp-2">{pkg.description}</p>
              )}

              {/* Core stats */}
              <div className="mt-3 pt-3 border-t border-stone-100 space-y-1.5">
                <div className="flex items-center gap-2 text-xs text-stone-600">
                  <span className="font-medium text-stone-800">{pkg.classCredits}</span> classes
                  <span className="text-stone-300">·</span>
                  <span className="font-medium text-stone-800">{pkg.validityDays}</span> days validity
                </div>
              </div>

              {/* Perks */}
              <div className="mt-2 flex flex-wrap gap-2">
                {pkg.guestPassesPerPeriod > 0 && (
                  <span className="flex items-center gap-1 text-xs text-blue-700 bg-blue-50 rounded-lg px-2 py-0.5">
                    <Users className="h-3 w-3" />
                    {pkg.guestPassesPerPeriod} guest pass{pkg.guestPassesPerPeriod > 1 ? "es" : ""}
                  </span>
                )}
                {pkg.drinksPerPeriod > 0 && (
                  <span className="flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 rounded-lg px-2 py-0.5">
                    <Coffee className="h-3 w-3" />
                    {pkg.drinksPerPeriod} drink{pkg.drinksPerPeriod > 1 ? "s" : ""}
                  </span>
                )}
                {pkg.workshopDiscountPercent > 0 && (
                  <span className="flex items-center gap-1 text-xs text-purple-700 bg-purple-50 rounded-lg px-2 py-0.5">
                    <Percent className="h-3 w-3" />
                    {pkg.workshopDiscountPercent}% workshop discount
                  </span>
                )}
                {pkg.priorityBooking && (
                  <span className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 rounded-lg px-2 py-0.5">
                    <Gift className="h-3 w-3" />
                    Priority booking
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected summary strip */}
      {selected && (
        <div className="rounded-xl bg-sage-50 border border-sage-200 px-4 py-3 flex items-center gap-3">
          <Check className="h-4 w-4 text-sage-600 flex-shrink-0" />
          <p className="text-sm text-sage-800 font-medium">
            {selected.name} — {formatCurrency(selected.price)} · {selected.classCredits} classes · {selected.validityDays} days
          </p>
        </div>
      )}

      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Button onClick={onNext} disabled={!selected}>
          Next: Schedule
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

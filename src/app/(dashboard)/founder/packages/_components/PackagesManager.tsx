"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import {
  Plus,
  Star,
  Users,
  Coffee,
  Ticket,
  Clock,
  ChevronDown,
  ArchiveX,
  Edit2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { cn, formatCurrency } from "@/lib/utils";
import type { PackageWithStats, CreatePackageForm } from "@/types";

interface Props {
  packages: PackageWithStats[];
}

const packageTypeColors: Record<string, string> = {
  membership: "sage",
  pack: "blue",
  drop_in: "default",
  founding: "founding",
};

export function PackagesManager({ packages }: Props) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [editPkg, setEditPkg] = useState<PackageWithStats | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreatePackageForm>({
    defaultValues: {
      type: "pack",
      priorityBooking: false,
      requiresStudentId: false,
      isFounding: false,
      isActive: true,
      isVisible: true,
      price: 0,
      classCredits: 10,
      validityDays: 30,
      guestPassesPerPeriod: 0,
      workshopDiscountPercent: 0,
      drinksPerPeriod: 0,
      minCommitmentMonths: 0,
      priceLockMonths: 0,
    },
  });

  async function onSubmit(values: CreatePackageForm) {
    try {
      const url = editPkg ? `/api/packages/${editPkg.id}` : "/api/packages";
      const method = editPkg ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save package");
      toast.success(editPkg ? "Package updated" : "Package created");
      setCreateOpen(false);
      setEditPkg(null);
      reset();
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  async function archivePackage(id: string) {
    try {
      const res = await fetch(`/api/packages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false }),
      });
      if (!res.ok) throw new Error("Failed to archive");
      toast.success("Package archived");
      router.refresh();
    } catch {
      toast.error("Failed to archive package");
    }
  }

  const active = packages.filter((p) => p.isActive);
  const archived = packages.filter((p) => !p.isActive);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-stone-900">Packages</h1>
          <p className="text-sm text-stone-500">{active.length} active plans</p>
        </div>
        <Button onClick={() => { reset(); setEditPkg(null); setCreateOpen(true); }}>
          <Plus className="h-4 w-4" />
          Create Package
        </Button>
      </div>

      {/* Package grid */}
      {active.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-stone-400">No packages yet. Create your first one!</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {active.map((pkg) => (
            <PackageCard
              key={pkg.id}
              pkg={pkg}
              onEdit={() => {
                setEditPkg(pkg);
                reset({
                  name: pkg.name,
                  type: pkg.type,
                  price: pkg.price,
                  classCredits: pkg.classCredits,
                  validityDays: pkg.validityDays,
                  guestPassesPerPeriod: pkg.guestPassesPerPeriod,
                  workshopDiscountPercent: pkg.workshopDiscountPercent,
                  drinksPerPeriod: pkg.drinksPerPeriod,
                  bookingWindowHours: pkg.bookingWindowHours ?? undefined,
                  priorityBooking: pkg.priorityBooking,
                  minCommitmentMonths: pkg.minCommitmentMonths,
                  priceLockMonths: pkg.priceLockMonths,
                  maxQuantity: pkg.maxQuantity ?? undefined,
                  requiresStudentId: pkg.requiresStudentId,
                  isFounding: pkg.isFounding,
                  isActive: pkg.isActive,
                  isVisible: pkg.isVisible,
                  description: pkg.description ?? undefined,
                });
                setCreateOpen(true);
              }}
              onArchive={() => archivePackage(pkg.id)}
            />
          ))}
        </div>
      )}

      {/* Archived section */}
      {archived.length > 0 && (
        <details className="group">
          <summary className="flex items-center gap-2 cursor-pointer text-sm text-stone-500 hover:text-stone-700 transition-colors list-none">
            <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
            Archived packages ({archived.length})
          </summary>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {archived.map((pkg) => (
              <div key={pkg.id} className="opacity-60">
                <PackageCard pkg={pkg} onEdit={() => {}} onArchive={() => {}} />
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Create / Edit Modal */}
      <Modal
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) { reset(); setEditPkg(null); }
        }}
        title={editPkg ? "Edit Package" : "Create Package"}
        description="Configure all aspects of this membership plan."
        size="xl"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Name + Type */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <label className="text-sm font-medium text-stone-700">Package Name</label>
              <input
                type="text"
                placeholder="e.g. Premium Monthly Membership"
                {...register("name", { required: "Name is required" })}
                className="w-full h-10 px-3 rounded-xl border border-stone-200 bg-white text-sm focus:outline-none focus:border-sage-400 focus:ring-2 focus:ring-sage-100"
              />
              {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-stone-700">Type</label>
              <select
                {...register("type", { required: true })}
                className="w-full h-10 px-3 rounded-xl border border-stone-200 bg-white text-sm focus:outline-none focus:border-sage-400"
              >
                <option value="membership">Membership (monthly)</option>
                <option value="pack">Credit Pack</option>
                <option value="drop_in">Drop-in</option>
                <option value="founding">Founding Member</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-stone-700">Price (AED)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                {...register("price", { required: true, valueAsNumber: true, min: 0 })}
                className="w-full h-10 px-3 rounded-xl border border-stone-200 bg-white text-sm focus:outline-none focus:border-sage-400 focus:ring-2 focus:ring-sage-100"
              />
            </div>
          </div>

          {/* Credits + Validity */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-stone-700">Class Credits</label>
              <input
                type="number"
                min="1"
                {...register("classCredits", { required: true, valueAsNumber: true, min: 1 })}
                className="w-full h-10 px-3 rounded-xl border border-stone-200 bg-white text-sm focus:outline-none focus:border-sage-400 focus:ring-2 focus:ring-sage-100"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-stone-700">Validity (days)</label>
              <input
                type="number"
                min="1"
                {...register("validityDays", { required: true, valueAsNumber: true, min: 1 })}
                className="w-full h-10 px-3 rounded-xl border border-stone-200 bg-white text-sm focus:outline-none focus:border-sage-400 focus:ring-2 focus:ring-sage-100"
              />
            </div>
          </div>

          {/* Perks */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-stone-700">Guest Passes</label>
              <input
                type="number"
                min="0"
                {...register("guestPassesPerPeriod", { valueAsNumber: true, min: 0 })}
                className="w-full h-10 px-3 rounded-xl border border-stone-200 bg-white text-sm focus:outline-none focus:border-sage-400 focus:ring-2 focus:ring-sage-100"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-stone-700">Drinks/Period</label>
              <input
                type="number"
                min="0"
                {...register("drinksPerPeriod", { valueAsNumber: true, min: 0 })}
                className="w-full h-10 px-3 rounded-xl border border-stone-200 bg-white text-sm focus:outline-none focus:border-sage-400 focus:ring-2 focus:ring-sage-100"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-stone-700">Workshop Disc. %</label>
              <input
                type="number"
                min="0"
                max="100"
                {...register("workshopDiscountPercent", { valueAsNumber: true, min: 0, max: 100 })}
                className="w-full h-10 px-3 rounded-xl border border-stone-200 bg-white text-sm focus:outline-none focus:border-sage-400 focus:ring-2 focus:ring-sage-100"
              />
            </div>
          </div>

          {/* Advanced */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-stone-700">Min Commitment (months)</label>
              <input
                type="number"
                min="0"
                {...register("minCommitmentMonths", { valueAsNumber: true, min: 0 })}
                className="w-full h-10 px-3 rounded-xl border border-stone-200 bg-white text-sm focus:outline-none focus:border-sage-400 focus:ring-2 focus:ring-sage-100"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-stone-700">Price Lock (months)</label>
              <input
                type="number"
                min="0"
                {...register("priceLockMonths", { valueAsNumber: true, min: 0 })}
                className="w-full h-10 px-3 rounded-xl border border-stone-200 bg-white text-sm focus:outline-none focus:border-sage-400 focus:ring-2 focus:ring-sage-100"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-stone-700">Max Quantity (optional)</label>
              <input
                type="number"
                min="1"
                placeholder="Unlimited"
                {...register("maxQuantity", { valueAsNumber: true, min: 1 })}
                className="w-full h-10 px-3 rounded-xl border border-stone-200 bg-white text-sm focus:outline-none focus:border-sage-400 focus:ring-2 focus:ring-sage-100"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-stone-700">Booking Window (hrs)</label>
              <input
                type="number"
                min="1"
                placeholder="Default"
                {...register("bookingWindowHours", { valueAsNumber: true, min: 1 })}
                className="w-full h-10 px-3 rounded-xl border border-stone-200 bg-white text-sm focus:outline-none focus:border-sage-400 focus:ring-2 focus:ring-sage-100"
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-stone-700">Description (optional)</label>
            <textarea
              rows={3}
              placeholder="Brief description shown to clients…"
              {...register("description")}
              className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-white text-sm focus:outline-none focus:border-sage-400 focus:ring-2 focus:ring-sage-100 resize-none"
            />
          </div>

          {/* Checkboxes */}
          <div className="flex flex-wrap gap-4">
            {[
              { name: "priorityBooking" as const, label: "Priority Booking" },
              { name: "requiresStudentId" as const, label: "Requires Student ID" },
              { name: "isFounding" as const, label: "Founding Member" },
              { name: "isVisible" as const, label: "Visible to Clients" },
              { name: "isActive" as const, label: "Active" },
            ].map(({ name, label }) => (
              <label key={name} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  {...register(name)}
                  className="rounded"
                />
                <span className="text-sm text-stone-700">{label}</span>
              </label>
            ))}
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => { setCreateOpen(false); reset(); setEditPkg(null); }}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" loading={isSubmitting}>
              {editPkg ? "Save Changes" : "Create Package"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function PackageCard({
  pkg,
  onEdit,
  onArchive,
}: {
  pkg: PackageWithStats;
  onEdit: () => void;
  onArchive: () => void;
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="truncate">{pkg.name}</CardTitle>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={packageTypeColors[pkg.type] as "sage" | "blue" | "default" | "founding"}>
                {pkg.type.replace("_", " ")}
              </Badge>
              {pkg.isFounding && (
                <Badge variant="founding">
                  <Star className="h-3 w-3" /> Founding
                </Badge>
              )}
            </div>
          </div>
          <p className="text-xl font-bold text-stone-900 flex-shrink-0">
            {formatCurrency(pkg.price)}
          </p>
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-3">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div className="flex items-center gap-1.5 text-stone-600">
            <Ticket className="h-3.5 w-3.5 text-stone-400" />
            {pkg.classCredits} credits
          </div>
          <div className="flex items-center gap-1.5 text-stone-600">
            <Clock className="h-3.5 w-3.5 text-stone-400" />
            {pkg.validityDays} days
          </div>
          {pkg.guestPassesPerPeriod > 0 && (
            <div className="flex items-center gap-1.5 text-stone-600">
              <Users className="h-3.5 w-3.5 text-stone-400" />
              {pkg.guestPassesPerPeriod} guest pass{pkg.guestPassesPerPeriod > 1 ? "es" : ""}
            </div>
          )}
          {pkg.drinksPerPeriod > 0 && (
            <div className="flex items-center gap-1.5 text-stone-600">
              <Coffee className="h-3.5 w-3.5 text-stone-400" />
              {pkg.drinksPerPeriod} drink{pkg.drinksPerPeriod > 1 ? "s" : ""}/period
            </div>
          )}
          {pkg.workshopDiscountPercent > 0 && (
            <div className="flex items-center gap-1.5 text-stone-600 col-span-2">
              <Star className="h-3.5 w-3.5 text-stone-400" />
              {pkg.workshopDiscountPercent}% workshop discount
            </div>
          )}
        </div>

        {pkg.description && (
          <p className="text-xs text-stone-500 line-clamp-2">{pkg.description}</p>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-stone-100">
          <span className="text-xs text-stone-500">
            {pkg.activePurchases ?? 0} active{" "}
            {(pkg.activePurchases ?? 0) === 1 ? "member" : "members"}
          </span>
          {pkg.maxQuantity && (
            <span className="text-xs text-stone-500">
              {pkg.soldCount}/{pkg.maxQuantity} sold
            </span>
          )}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={onEdit}>
            <Edit2 className="h-3.5 w-3.5" />
            Edit
          </Button>
          {pkg.isActive && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onArchive}
              className="text-stone-400 hover:text-red-500"
            >
              <ArchiveX className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

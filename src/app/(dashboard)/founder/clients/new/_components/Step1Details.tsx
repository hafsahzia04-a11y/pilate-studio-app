"use client";

import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { ArrowRight, User } from "lucide-react";
import type { RegistrationDetails } from "@/types";

interface Props {
  data: RegistrationDetails;
  onChange: (data: RegistrationDetails) => void;
  onNext: () => void;
}

const inputCls =
  "w-full h-10 px-3 rounded-xl border border-stone-200 bg-white text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:border-sage-400 focus:ring-2 focus:ring-sage-100";

export function Step1Details({ data, onChange, onNext }: Props) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegistrationDetails>({ defaultValues: data });

  function onSubmit(values: RegistrationDetails) {
    onChange(values);
    onNext();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="flex items-center gap-2 mb-1">
        <User className="h-5 w-5 text-sage-500" />
        <h2 className="text-base font-semibold text-stone-900">Client Details</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Full Name */}
        <div className="space-y-1.5 sm:col-span-2">
          <label className="text-sm font-medium text-stone-700">
            Full Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            placeholder="e.g. Hana Malik"
            {...register("fullName", { required: "Full name is required" })}
            className={inputCls}
          />
          {errors.fullName && (
            <p className="text-xs text-red-500">{errors.fullName.message}</p>
          )}
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-stone-700">
            Email Address <span className="text-red-400">*</span>
          </label>
          <input
            type="email"
            placeholder="hana@example.com"
            {...register("email", {
              required: "Email is required",
              pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Invalid email" },
            })}
            className={inputCls}
          />
          {errors.email && (
            <p className="text-xs text-red-500">{errors.email.message}</p>
          )}
        </div>

        {/* Phone */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-stone-700">
            Phone Number <span className="text-red-400">*</span>
          </label>
          <input
            type="tel"
            placeholder="+92 300 1234567"
            {...register("phone", { required: "Phone number is required" })}
            className={inputCls}
          />
          {errors.phone && (
            <p className="text-xs text-red-500">{errors.phone.message}</p>
          )}
        </div>

        {/* Age */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-stone-700">Age (optional)</label>
          <input
            type="number"
            placeholder="e.g. 28"
            min={13}
            max={120}
            {...register("age")}
            className={inputCls}
          />
        </div>

        {/* Notes */}
        <div className="space-y-1.5 sm:col-span-2">
          <label className="text-sm font-medium text-stone-700">
            Internal Notes (optional)
          </label>
          <textarea
            placeholder="Any relevant notes about this client…"
            rows={3}
            {...register("notes")}
            className="w-full px-3 py-2.5 rounded-xl border border-stone-200 bg-white text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:border-sage-400 focus:ring-2 focus:ring-sage-100 resize-none"
          />
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button type="submit">
          Next: Package
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </form>
  );
}

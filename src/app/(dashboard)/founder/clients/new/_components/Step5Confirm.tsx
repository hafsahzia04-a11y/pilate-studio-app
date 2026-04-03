"use client";

import { ArrowLeft, CheckCircle2, User, Package2, Calendar, CreditCard, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency, formatDate, formatTime } from "@/lib/utils";
import { addDays } from "date-fns";
import type { RegistrationDetails, RegistrationPayment } from "@/types";
import type { PackageForPicker, SessionForPicker } from "./RegistrationWizard";

interface Props {
  details: RegistrationDetails;
  selectedPackage: PackageForPicker | null;
  selectedSessions: SessionForPicker[];
  payment: RegistrationPayment;
  onConfirm: () => void;
  onBack: () => void;
  isSubmitting: boolean;
}

function paymentStatusBadge(status: string) {
  if (status === "paid") return <Badge variant="sage">Paid in Full</Badge>;
  if (status === "partial") return <Badge variant="warning">Partial Payment</Badge>;
  return <Badge variant="default">Unpaid</Badge>;
}

export function Step5Confirm({
  details,
  selectedPackage,
  selectedSessions,
  payment,
  onConfirm,
  onBack,
  isSubmitting,
}: Props) {
  const today = new Date();
  const expiryDate = selectedPackage ? addDays(today, selectedPackage.validityDays) : null;
  const outstanding = selectedPackage
    ? selectedPackage.price - (payment.paymentStatus === "unpaid" ? 0 : payment.amountPaid)
    : 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 mb-1">
        <CheckCircle2 className="h-5 w-5 text-sage-500" />
        <h2 className="text-base font-semibold text-stone-900">Review & Confirm</h2>
      </div>
      <p className="text-sm text-stone-500">
        Please review everything before creating the client record.
      </p>

      {/* Client details */}
      <section className="rounded-xl border border-stone-200 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 bg-stone-50 border-b border-stone-200">
          <User className="h-4 w-4 text-stone-500" />
          <p className="text-xs font-semibold text-stone-600 uppercase tracking-wide">Client</p>
        </div>
        <div className="px-4 py-3 grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-xs text-stone-400">Name</p>
            <p className="font-medium text-stone-800">{details.fullName}</p>
          </div>
          <div>
            <p className="text-xs text-stone-400">Phone</p>
            <p className="font-medium text-stone-800">{details.phone}</p>
          </div>
          <div className="col-span-2">
            <p className="text-xs text-stone-400">Email</p>
            <p className="font-medium text-stone-800">{details.email}</p>
          </div>
          {details.age && (
            <div>
              <p className="text-xs text-stone-400">Age</p>
              <p className="font-medium text-stone-800">{details.age}</p>
            </div>
          )}
          {details.notes && (
            <div className="col-span-2">
              <p className="text-xs text-stone-400">Notes</p>
              <p className="text-stone-600 text-xs">{details.notes}</p>
            </div>
          )}
        </div>
      </section>

      {/* Package */}
      {selectedPackage && (
        <section className="rounded-xl border border-stone-200 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-stone-50 border-b border-stone-200">
            <Package2 className="h-4 w-4 text-stone-500" />
            <p className="text-xs font-semibold text-stone-600 uppercase tracking-wide">Package</p>
          </div>
          <div className="px-4 py-3 grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-xs text-stone-400">Package</p>
              <p className="font-medium text-stone-800">{selectedPackage.name}</p>
            </div>
            <div>
              <p className="text-xs text-stone-400">Price</p>
              <p className="font-medium text-stone-800">{formatCurrency(selectedPackage.price)}</p>
            </div>
            <div>
              <p className="text-xs text-stone-400">Start Date</p>
              <p className="font-medium text-stone-800">{formatDate(today)}</p>
            </div>
            <div>
              <p className="text-xs text-stone-400">Expiry Date</p>
              <p className="font-medium text-stone-800">{expiryDate ? formatDate(expiryDate) : "—"}</p>
            </div>
            <div>
              <p className="text-xs text-stone-400">Credits</p>
              <p className="font-medium text-stone-800">{selectedPackage.classCredits} classes</p>
            </div>
          </div>
        </section>
      )}

      {/* Selected classes */}
      <section className="rounded-xl border border-stone-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 bg-stone-50 border-b border-stone-200">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-stone-500" />
            <p className="text-xs font-semibold text-stone-600 uppercase tracking-wide">
              Bookings ({selectedSessions.length})
            </p>
          </div>
        </div>
        {selectedSessions.length === 0 ? (
          <div className="px-4 py-3 text-sm text-stone-400">
            No classes selected — client can book from their profile later.
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {selectedSessions.map((s) => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                <div
                  className="w-1 h-8 rounded-full flex-shrink-0"
                  style={{ backgroundColor: s.category.color }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-stone-800 truncate">{s.title}</p>
                  <p className="text-xs text-stone-500">
                    {formatDate(s.startTime)} at {formatTime(s.startTime)} · {s.instructor.fullName}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Payment */}
      <section className="rounded-xl border border-stone-200 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 bg-stone-50 border-b border-stone-200">
          <CreditCard className="h-4 w-4 text-stone-500" />
          <p className="text-xs font-semibold text-stone-600 uppercase tracking-wide">Payment</p>
        </div>
        <div className="px-4 py-3 grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-xs text-stone-400">Status</p>
            <div className="mt-0.5">{paymentStatusBadge(payment.paymentStatus)}</div>
          </div>
          {payment.paymentStatus !== "unpaid" && (
            <>
              <div>
                <p className="text-xs text-stone-400">Amount Paid</p>
                <p className="font-medium text-sage-700">{formatCurrency(payment.amountPaid)}</p>
              </div>
              <div>
                <p className="text-xs text-stone-400">Method</p>
                <p className="font-medium text-stone-800 capitalize">{payment.paymentMethod.replace("_", " ")}</p>
              </div>
            </>
          )}
          {outstanding > 0 && (
            <div className={cn("col-span-2 rounded-lg px-3 py-2", "bg-red-50 border border-red-100")}>
              <div className="flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                <p className="text-xs text-red-700 font-medium">
                  Outstanding: {formatCurrency(outstanding)}
                  {payment.dueDate ? ` · Due ${formatDate(payment.dueDate)}` : ""}
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack} disabled={isSubmitting}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Button onClick={onConfirm} loading={isSubmitting} className="min-w-[160px]">
          <CheckCircle2 className="h-4 w-4" />
          {isSubmitting ? "Registering…" : "Register Client"}
        </Button>
      </div>
    </div>
  );
}

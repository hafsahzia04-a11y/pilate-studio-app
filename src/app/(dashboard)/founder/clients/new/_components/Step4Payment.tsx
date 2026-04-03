"use client";

import { ArrowLeft, ArrowRight, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency } from "@/lib/utils";
import type { RegistrationPayment } from "@/types";

interface Props {
  packagePrice: number;
  packageName: string;
  payment: RegistrationPayment;
  onChange: (payment: RegistrationPayment) => void;
  onNext: () => void;
  onBack: () => void;
}

const inputCls =
  "w-full h-10 px-3 rounded-xl border border-stone-200 bg-white text-sm text-stone-800 focus:outline-none focus:border-sage-400 focus:ring-2 focus:ring-sage-100";

export function Step4Payment({
  packagePrice,
  packageName,
  payment,
  onChange,
  onNext,
  onBack,
}: Props) {
  const outstanding = packagePrice - (payment.paymentStatus === "unpaid" ? 0 : payment.amountPaid);

  const statusOptions: { value: RegistrationPayment["paymentStatus"]; label: string; desc: string }[] = [
    { value: "paid", label: "Paid in Full", desc: "Client has paid the full amount." },
    { value: "partial", label: "Partial Payment", desc: "Client has paid a portion. Due date required." },
    { value: "unpaid", label: "Unpaid / Due Later", desc: "No payment collected yet. Status will show as unpaid." },
  ];

  function update(patch: Partial<RegistrationPayment>) {
    onChange({ ...payment, ...patch });
  }

  function handleStatusChange(status: RegistrationPayment["paymentStatus"]) {
    let amountPaid = payment.amountPaid;
    if (status === "paid") amountPaid = packagePrice;
    if (status === "unpaid") amountPaid = 0;
    update({ paymentStatus: status, amountPaid });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 mb-1">
        <CreditCard className="h-5 w-5 text-sage-500" />
        <h2 className="text-base font-semibold text-stone-900">Payment</h2>
      </div>

      {/* Package price summary */}
      <div className="rounded-xl bg-stone-50 border border-stone-200 px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-xs text-stone-500">Package</p>
          <p className="font-semibold text-stone-800 text-sm">{packageName}</p>
        </div>
        <p className="text-xl font-bold text-stone-900">{formatCurrency(packagePrice)}</p>
      </div>

      {/* Payment status selector */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-stone-700">Payment Status</label>
        <div className="space-y-2">
          {statusOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleStatusChange(opt.value)}
              className={cn(
                "w-full text-left px-4 py-3 rounded-xl border-2 transition-all",
                payment.paymentStatus === opt.value
                  ? "border-sage-500 bg-sage-50"
                  : "border-stone-200 hover:border-stone-300"
              )}
            >
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                    payment.paymentStatus === opt.value
                      ? "border-sage-500"
                      : "border-stone-300"
                  )}
                >
                  {payment.paymentStatus === opt.value && (
                    <div className="w-2 h-2 rounded-full bg-sage-500" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-stone-800">{opt.label}</p>
                  <p className="text-xs text-stone-500">{opt.desc}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Amount paid + method (if not unpaid) */}
      {payment.paymentStatus !== "unpaid" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-stone-700">Amount Paid (PKR)</label>
            <input
              type="number"
              min={0}
              max={packagePrice}
              value={payment.amountPaid || ""}
              onChange={(e) => update({ amountPaid: Number(e.target.value) })}
              className={inputCls}
              placeholder={`Max ${packagePrice}`}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-stone-700">Payment Method</label>
            <select
              value={payment.paymentMethod}
              onChange={(e) => update({ paymentMethod: e.target.value })}
              className={inputCls}
            >
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="online">Online</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
      )}

      {/* Due date for partial/unpaid */}
      {payment.paymentStatus !== "paid" && (
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-stone-700">Payment Due Date (optional)</label>
          <input
            type="date"
            value={payment.dueDate ?? ""}
            onChange={(e) => update({ dueDate: e.target.value })}
            className={inputCls}
          />
          <p className="text-xs text-stone-400">If set, the client will show as overdue after this date if unpaid.</p>
        </div>
      )}

      {/* Notes */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-stone-700">Payment Notes (optional)</label>
        <input
          type="text"
          placeholder="e.g. Promised to pay by Friday"
          value={payment.notes ?? ""}
          onChange={(e) => update({ notes: e.target.value })}
          className={inputCls}
        />
      </div>

      {/* Summary */}
      <div className="rounded-xl border border-stone-200 divide-y divide-stone-100">
        <div className="flex justify-between px-4 py-2.5 text-sm">
          <span className="text-stone-600">Total Due</span>
          <span className="font-semibold">{formatCurrency(packagePrice)}</span>
        </div>
        <div className="flex justify-between px-4 py-2.5 text-sm">
          <span className="text-stone-600">Amount Paid</span>
          <span
            className={cn(
              "font-semibold",
              payment.paymentStatus === "paid" ? "text-sage-600" : "text-stone-800"
            )}
          >
            {formatCurrency(payment.paymentStatus === "unpaid" ? 0 : payment.amountPaid)}
          </span>
        </div>
        <div className="flex justify-between px-4 py-2.5 text-sm">
          <span className="text-stone-600">Outstanding</span>
          <span
            className={cn(
              "font-bold",
              outstanding <= 0 ? "text-sage-600" : "text-red-600"
            )}
          >
            {formatCurrency(Math.max(0, outstanding))}
          </span>
        </div>
      </div>

      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Button onClick={onNext}>
          Review & Confirm
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

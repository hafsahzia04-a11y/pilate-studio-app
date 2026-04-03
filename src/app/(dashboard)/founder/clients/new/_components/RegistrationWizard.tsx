"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { ArrowLeft } from "lucide-react";
import { Stepper } from "@/components/ui/stepper";
import { Button } from "@/components/ui/button";
import type { RegistrationDetails, RegistrationPayment } from "@/types";
import { Step1Details } from "./Step1Details";
import { Step2Package } from "./Step2Package";
import { Step3Schedule } from "./Step3Schedule";
import { Step4Payment } from "./Step4Payment";
import { Step5Confirm } from "./Step5Confirm";

export interface SessionForPicker {
  id: string;
  title: string;
  category: { name: string; color: string };
  instructor: { id: string; fullName: string };
  room?: string | null;
  startTime: Date | string;
  endTime: Date | string;
  durationMins: number;
  capacity: number;
  isWorkshop: boolean;
  workshopPrice?: number | null;
  usesCredits: boolean;
  status: string;
  bookedCount: number;
  spotsLeft: number;
  isFull: boolean;
}

export interface PackageForPicker {
  id: string;
  name: string;
  type: string;
  price: number;
  classCredits: number;
  validityDays: number;
  guestPassesPerPeriod: number;
  workshopDiscountPercent: number;
  drinksPerPeriod: number;
  priorityBooking: boolean;
  isFounding: boolean;
  requiresStudentId: boolean;
  description?: string | null;
}

interface Props {
  packages: PackageForPicker[];
  sessions: SessionForPicker[];
}

const STEP_LABELS = ["Details", "Package", "Schedule", "Payment", "Confirm"];

export function RegistrationWizard({ packages, sessions }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [details, setDetails] = useState<RegistrationDetails>({
    fullName: "",
    email: "",
    phone: "",
    age: "",
    notes: "",
  });
  const [selectedPackage, setSelectedPackage] = useState<PackageForPicker | null>(null);
  const [selectedSessions, setSelectedSessions] = useState<SessionForPicker[]>([]);
  const [payment, setPayment] = useState<RegistrationPayment>({
    paymentStatus: "unpaid",
    amountPaid: 0,
    paymentMethod: "cash",
    dueDate: "",
    notes: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  function goBack() {
    if (step > 1) setStep((s) => s - 1);
  }

  async function onConfirm() {
    if (!selectedPackage) return;
    setIsSubmitting(true);

    try {
      // Step 1: Create the client
      const clientRes = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: details.fullName,
          email: details.email,
          phone: details.phone,
          staffNotes: details.notes,
          temporaryPassword: generateTempPassword(),
        }),
      });
      const clientData = await clientRes.json();
      if (!clientRes.ok) throw new Error(clientData.error ?? "Failed to create client");
      const clientId = clientData.id;

      // Step 2: Sell package to client
      const today = new Date().toISOString();
      const pkgRes = await fetch(`/api/packages/${selectedPackage.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          startDate: today,
          paymentMethod: payment.paymentMethod,
          amountPaid: payment.paymentStatus === "unpaid" ? 0 : payment.amountPaid,
          notes: payment.notes,
        }),
      });
      const pkgData = await pkgRes.json();
      if (!pkgRes.ok) throw new Error(pkgData.error ?? "Failed to assign package");
      const clientPackageId = pkgData.id;

      // Step 3: Create bookings for selected sessions
      const bookingErrors: string[] = [];
      for (const session of selectedSessions) {
        const bookRes = await fetch("/api/bookings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            classSessionId: session.id,
            clientId,
            clientPackageId,
          }),
        });
        if (!bookRes.ok) {
          const bd = await bookRes.json();
          bookingErrors.push(`${session.title}: ${bd.error ?? "Failed"}`);
        }
      }

      if (bookingErrors.length > 0) {
        toast.error(`Client registered but some bookings failed:\n${bookingErrors.join("\n")}`);
      } else {
        toast.success("Client registered successfully!");
      }

      router.push(`/founder/clients/${clientId}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Registration failed");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => router.push("/founder/clients")}
          title="Back to clients"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-stone-900">Register New Client</h1>
          <p className="text-sm text-stone-500">Step {step} of {STEP_LABELS.length}</p>
        </div>
      </div>

      {/* Stepper */}
      <Stepper steps={STEP_LABELS} current={step} />

      {/* Step content */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
        {step === 1 && (
          <Step1Details
            data={details}
            onChange={setDetails}
            onNext={() => setStep(2)}
          />
        )}
        {step === 2 && (
          <Step2Package
            packages={packages}
            selected={selectedPackage}
            onSelect={setSelectedPackage}
            onNext={() => setStep(3)}
            onBack={goBack}
          />
        )}
        {step === 3 && (
          <Step3Schedule
            sessions={sessions}
            selectedSessions={selectedSessions}
            onSelectSessions={setSelectedSessions}
            maxCredits={selectedPackage?.classCredits ?? 0}
            onNext={() => setStep(4)}
            onBack={goBack}
          />
        )}
        {step === 4 && (
          <Step4Payment
            packagePrice={selectedPackage?.price ?? 0}
            packageName={selectedPackage?.name ?? ""}
            payment={payment}
            onChange={setPayment}
            onNext={() => setStep(5)}
            onBack={goBack}
          />
        )}
        {step === 5 && (
          <Step5Confirm
            details={details}
            selectedPackage={selectedPackage}
            selectedSessions={selectedSessions}
            payment={payment}
            onConfirm={onConfirm}
            onBack={goBack}
            isSubmitting={isSubmitting}
          />
        )}
      </div>
    </div>
  );
}

function generateTempPassword(): string {
  return Math.random().toString(36).slice(-8) + "A1!";
}

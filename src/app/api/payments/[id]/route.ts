// DELETE /api/payments/[id]  — soft-delete a payment record (founder only)

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { audit, AUDIT_ACTIONS } from "@/lib/audit";
import { apiError, apiSuccess } from "@/lib/utils";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorised", 401);

  const actor = await prisma.profile.findUnique({ where: { id: user.id } });
  if (actor?.role !== "founder") return apiError("Only founders can delete payments", 403);

  const payment = await prisma.payment.findUnique({
    where: { id: params.id },
    include: { clientPackage: true },
  });
  if (!payment) return apiError("Payment not found", 404);

  // Reverse the payment: subtract amount from clientPackage.amountPaid and update status
  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: params.id },
      data: { status: "refunded" },
    });

    if (payment.clientPackageId) {
      const cp = payment.clientPackage!;
      const newAmountPaid = Math.max(0, Number(cp.amountPaid) - Number(payment.amount));
      const newStatus = newAmountPaid <= 0 ? "unpaid" : newAmountPaid < Number(cp.amountDue) ? "partial" : "paid";
      await tx.clientPackage.update({
        where: { id: payment.clientPackageId },
        data: { amountPaid: newAmountPaid, paymentStatus: newStatus },
      });
    }
  });

  await audit({
    actorId: user.id,
    action: AUDIT_ACTIONS.PAYMENT_REFUNDED,
    entityType: "payment",
    entityId: params.id,
    oldValue: { status: payment.status, amount: Number(payment.amount) },
    newValue: { status: "refunded", deleted: true },
  });

  return apiSuccess({ deleted: true });
}

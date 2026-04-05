// PATCH  /api/payments/[id]  — update amount/method/notes/paidAt (founder only)
// DELETE /api/payments/[id]  — soft-delete a payment record (founder only)

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { audit, AUDIT_ACTIONS } from "@/lib/audit";
import { apiError, apiSuccess } from "@/lib/utils";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorised", 401);

  const actor = await prisma.profile.findUnique({ where: { id: user.id } });
  if (actor?.role !== "founder") return apiError("Only founders can edit payments", 403);

  const payment = await prisma.payment.findUnique({ where: { id: params.id } });
  if (!payment) return apiError("Payment not found", 404);

  const body = await request.json();
  const { amount, paymentMethod, notes, paidAt } = body;

  const amtNum = amount !== undefined ? Number(amount) : undefined;
  if (amtNum !== undefined && (isNaN(amtNum) || amtNum <= 0)) {
    return apiError("Invalid amount", 400);
  }

  const oldAmount = Number(payment.amount);

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.payment.update({
      where: { id: params.id },
      data: {
        ...(amtNum !== undefined && { amount: amtNum, netAmount: amtNum }),
        ...(paymentMethod !== undefined && { paymentMethod }),
        ...(notes !== undefined && { notes }),
        ...(paidAt !== undefined && { paidAt: paidAt ? new Date(paidAt) : null }),
      },
    });

    // If amount changed and payment belongs to a clientPackage, sync amountPaid
    if (amtNum !== undefined && amtNum !== oldAmount && payment.clientPackageId) {
      const cp = await tx.clientPackage.findUnique({ where: { id: payment.clientPackageId } });
      if (cp) {
        const newAmountPaid = Math.max(0, Number(cp.amountPaid) - oldAmount + amtNum);
        const newStatus = newAmountPaid <= 0 ? "unpaid" : newAmountPaid < Number(cp.amountDue) ? "partial" : "paid";
        await tx.clientPackage.update({
          where: { id: payment.clientPackageId },
          data: { amountPaid: newAmountPaid, paymentStatus: newStatus },
        });
      }
    }

    return result;
  });

  await audit({
    actorId: user.id,
    action: AUDIT_ACTIONS.PAYMENT_UPDATED,
    entityType: "payment",
    entityId: params.id,
    oldValue: { amount: oldAmount, paymentMethod: payment.paymentMethod, notes: payment.notes },
    newValue: { amount: amtNum ?? oldAmount, paymentMethod, notes },
  });

  return apiSuccess({ data: updated });
}

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

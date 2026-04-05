// GET  /api/payments  — list payments with filters
// POST /api/payments  — record a payment

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { audit, AUDIT_ACTIONS } from "@/lib/audit";
import { apiError, apiSuccess } from "@/lib/utils";
import { sendWhatsAppMessage, messages } from "@/lib/whatsapp";
import { formatCurrency } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorised", 401);

  const actor = await prisma.profile.findUnique({ where: { id: user.id } });
  if (!["founder", "staff"].includes(actor?.role ?? "")) {
    return apiError("Forbidden", 403);
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const clientId = searchParams.get("clientId");
  const overdue = searchParams.get("overdue") === "true";

  const now = new Date();

  const payments = await prisma.payment.findMany({
    where: {
      ...(clientId && { clientId }),
      ...(status && { status: status as never }),
      ...(overdue && {
        status: { in: ["unpaid", "partial"] },
        dueDate: { lt: now },
      }),
    },
    include: {
      client: { select: { id: true, fullName: true, phone: true, email: true } },
      clientPackage: {
        select: { package: { select: { name: true } } },
      },
      recordedBy: { select: { fullName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return apiSuccess(payments.map((p) => ({
    ...p,
    amount: Number(p.amount),
    netAmount: Number(p.netAmount),
    discountApplied: Number(p.discountApplied),
  })));
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorised", 401);

  const actor = await prisma.profile.findUnique({ where: { id: user.id } });
  if (!["founder", "staff"].includes(actor?.role ?? "")) {
    return apiError("Forbidden", 403);
  }

  const body = await request.json();
  const {
    clientId, amount, paymentMethod,
    discountApplied = 0, notes, referenceNumber,
    isDropIn = false, nextDueDate,
  } = body;
  let { clientPackageId } = body;

  if (!clientId || !amount) return apiError("clientId and amount are required");

  const amountNum = Number(amount);
  const discountNum = Number(discountApplied);
  const netAmount = amountNum - discountNum;

  // For a new drop-in purchase, create the ClientPackage first
  if (isDropIn) {
    const dropInPkg = await prisma.package.findFirst({
      where: { type: "drop_in", isActive: true },
    });
    if (!dropInPkg) return apiError("No active drop-in package defined. Please create one in Packages.");

    const today = new Date();
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const newCp = await prisma.clientPackage.create({
      data: {
        clientId,
        packageId: dropInPkg.id,
        startDate: todayDate,
        expiryDate: todayDate, // valid today only
        totalCredits: dropInPkg.classCredits,
        remainingCredits: dropInPkg.classCredits,
        usedCredits: 0,
        amountDue: Number(dropInPkg.price),
        amountPaid: amountNum,
        paymentStatus: amountNum >= Number(dropInPkg.price) ? "paid" : "partial",
        status: "active",
        drinksRemaining: 0,
        guestPassesRemaining: 0,
        createdById: user.id,
      },
    });
    clientPackageId = newCp.id;
  }

  const payment = await prisma.$transaction(async (tx) => {
    const p = await tx.payment.create({
      data: {
        clientId,
        clientPackageId: clientPackageId ?? null,
        amount: amountNum,
        discountApplied: discountNum,
        netAmount,
        paymentMethod: paymentMethod ?? "cash",
        status: "paid",
        paidAt: new Date(),
        notes: notes ?? null,
        referenceNumber: referenceNumber ?? null,
        recordedById: user.id,
      },
    });

    // Update client package payment status if linked (and not drop-in, which was already updated)
    if (clientPackageId && !isDropIn) {
      const cp = await tx.clientPackage.findUnique({ where: { id: clientPackageId } });
      if (cp) {
        const newAmountPaid = Number(cp.amountPaid) + amountNum;
        const outstanding = Number(cp.amountDue) - newAmountPaid;
        await tx.clientPackage.update({
          where: { id: clientPackageId },
          data: {
            amountPaid: newAmountPaid,
            paymentStatus: outstanding <= 0 ? "paid" : "partial",
            status: "active",
            ...(nextDueDate && { paymentDueDate: new Date(nextDueDate) }),
          },
        });
      }
    }

    return p;
  });

  await audit({
    actorId: user.id,
    action: AUDIT_ACTIONS.PAYMENT_RECORDED,
    entityType: "payment",
    entityId: payment.id,
    newValue: { clientId, amount: amountNum, paymentMethod },
  });

  // Confirmation to client if significant payment
  const client = await prisma.profile.findUnique({
    where: { id: clientId },
    select: { fullName: true, phone: true },
  });

  if (client?.phone && amountNum >= 10) {
    void sendWhatsAppMessage({
      phone: client.phone,
      message: `Hi ${client.fullName}, payment of ${formatCurrency(amountNum)} has been recorded. Thank you! 💚\n\n– The Movement Studio`,
      clientId,
      notificationType: "payment_recorded",
    });
  }

  return apiSuccess(payment, 201);
}

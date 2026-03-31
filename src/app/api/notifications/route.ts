// POST /api/notifications  — test WhatsApp, send bulk reminders

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { sendWhatsAppMessage, messages } from "@/lib/whatsapp";
import { getSetting } from "@/lib/settings";
import { apiError, apiSuccess } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorised", 401);

  const actor = await prisma.profile.findUnique({ where: { id: user.id } });
  if (!["founder", "staff"].includes(actor?.role ?? "")) {
    return apiError("Forbidden", 403);
  }

  const body = await request.json();
  const { action } = body;

  // ── Test WhatsApp connection ───────────────────────────────────────────────
  if (action === "test") {
    const phone =
      body.phone ?? process.env.FOUNDER_WHATSAPP_PHONE;
    if (!phone) return apiError("No phone number provided and FOUNDER_WHATSAPP_PHONE not set");

    const success = await sendWhatsAppMessage({
      phone,
      message: messages.testMessage(),
      notificationType: "test",
    });

    return apiSuccess({ success, message: success ? "Test message sent!" : "Failed to send. Check your API key." });
  }

  // ── Send expiry reminders (cron or manual) ────────────────────────────────
  if (action === "expiry_reminders") {
    const daysConfig = await getSetting("notify_expiry_days");
    const notifyDays = Array.isArray(daysConfig) ? daysConfig : [7, 3, 1];
    const now = new Date();
    let sent = 0;

    for (const days of notifyDays) {
      const target = new Date(now.getTime() + days * 86400000);
      const startOfDay = new Date(target);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(target);
      endOfDay.setHours(23, 59, 59, 999);

      const expiring = await prisma.clientPackage.findMany({
        where: {
          status: "active",
          expiryDate: { gte: startOfDay, lte: endOfDay },
        },
        include: {
          client: { select: { fullName: true, phone: true } },
          package: { select: { name: true } },
        },
      });

      for (const cp of expiring) {
        if (cp.client.phone) {
          await sendWhatsAppMessage({
            phone: cp.client.phone,
            message: messages.membershipExpiringSoon(
              cp.client.fullName,
              days,
              cp.package.name
            ),
            clientId: cp.clientId,
            notificationType: "expiry_reminder",
          });
          sent++;
        }
      }
    }

    return apiSuccess({ sent });
  }

  // ── Overdue payment reminders ─────────────────────────────────────────────
  if (action === "overdue_reminders") {
    const now = new Date();
    const overdue = await prisma.clientPackage.findMany({
      where: {
        paymentStatus: { in: ["unpaid", "partial"] },
        paymentDueDate: { lt: now },
      },
      include: {
        client: { select: { fullName: true, phone: true } },
        package: { select: { name: true } },
      },
    });

    let sent = 0;
    for (const cp of overdue) {
      if (cp.client.phone) {
        const daysPast = Math.floor(
          (now.getTime() - new Date(cp.paymentDueDate!).getTime()) / 86400000
        );
        const outstanding = Number(cp.amountDue) - Number(cp.amountPaid);

        await sendWhatsAppMessage({
          phone: cp.client.phone,
          message: messages.paymentOverdue(
            cp.client.fullName,
            formatCurrency(outstanding),
            cp.package.name,
            daysPast
          ),
          clientId: cp.clientId,
          notificationType: "payment_overdue",
        });
        sent++;
      }
    }

    return apiSuccess({ sent });
  }

  // ── Custom broadcast to all active members ────────────────────────────────
  if (action === "broadcast") {
    const { message } = body;
    if (!message) return apiError("message is required for broadcast");

    // Only founder can broadcast
    if (actor?.role !== "founder") return apiError("Only founders can broadcast messages");

    const activeClients = await prisma.profile.findMany({
      where: {
        role: "client",
        status: "active",
        phone: { not: null },
        clientPackages: { some: { status: "active" } },
      },
      select: { id: true, fullName: true, phone: true },
    });

    let sent = 0;
    for (const client of activeClients) {
      if (client.phone) {
        await sendWhatsAppMessage({
          phone: client.phone,
          message,
          clientId: client.id,
          notificationType: "broadcast",
        });
        sent++;
        // Small delay to respect rate limits
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    return apiSuccess({ sent });
  }

  return apiError("Invalid action. Use: test | expiry_reminders | overdue_reminders | broadcast");
}

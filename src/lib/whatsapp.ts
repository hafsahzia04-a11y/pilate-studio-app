// ─────────────────────────────────────────────────────────────────────────────
// WhatsApp Notifications via CallMeBot (free tier)
//
// HOW IT WORKS:
//   CallMeBot sends WhatsApp messages using a simple HTTP GET request.
//   URL: https://api.callmebot.com/whatsapp.php?phone=PHONE&text=MESSAGE&apikey=KEY
//
// SETUP (one-time, 2 minutes):
//   1. Save +34 644 59 78 14 as a contact (name it "CallMeBot")
//   2. Send this exact message to that contact on WhatsApp:
//      "I allow callmebot to send me messages"
//   3. Wait ~1 minute — you'll receive your API key via WhatsApp
//   4. Add it to your .env.local as CALLMEBOT_API_KEY
//   5. Add your number as FOUNDER_WHATSAPP_PHONE (country code, no +)
//      Example UAE: 971501234567
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from "@/lib/prisma";

interface SendWhatsAppOptions {
  phone: string; // E.164 without +, e.g. "971501234567"
  message: string;
  clientId?: string;
  notificationType?: string;
}

/**
 * Send a WhatsApp message via CallMeBot.
 * Returns true on success, false on failure.
 */
export async function sendWhatsAppMessage({
  phone,
  message,
  clientId,
  notificationType = "general",
}: SendWhatsAppOptions): Promise<boolean> {
  const apiKey = process.env.CALLMEBOT_API_KEY;

  if (!apiKey) {
    console.warn("[WhatsApp] CALLMEBOT_API_KEY not set — skipping message");
    await logNotification({
      clientId,
      type: notificationType,
      phone,
      message,
      status: "failed",
      errorMsg: "CALLMEBOT_API_KEY not configured",
    });
    return false;
  }

  // Sanitise the phone number — remove spaces, dashes, leading +
  const cleanPhone = phone.replace(/[\s\-\+]/g, "");
  const encodedMessage = encodeURIComponent(message);
  const url = `https://api.callmebot.com/whatsapp.php?phone=${cleanPhone}&text=${encodedMessage}&apikey=${apiKey}`;

  try {
    const res = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(10_000), // 10 second timeout
    });

    const body = await res.text();
    const success = res.ok && body.toLowerCase().includes("message queued");

    await logNotification({
      clientId,
      type: notificationType,
      phone: cleanPhone,
      message,
      status: success ? "sent" : "failed",
      errorMsg: success ? undefined : `HTTP ${res.status}: ${body.slice(0, 200)}`,
    });

    if (!success) {
      console.error(`[WhatsApp] Failed: HTTP ${res.status}`, body);
    }

    return success;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[WhatsApp] Network error:", errorMsg);

    await logNotification({
      clientId,
      type: notificationType,
      phone: cleanPhone,
      message,
      status: "failed",
      errorMsg,
    });

    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Persist every notification attempt to the DB for audit / debugging
// ─────────────────────────────────────────────────────────────────────────────

async function logNotification({
  clientId,
  type,
  phone,
  message,
  status,
  errorMsg,
}: {
  clientId?: string;
  type: string;
  phone: string;
  message: string;
  status: "sent" | "failed" | "pending";
  errorMsg?: string;
}) {
  try {
    await prisma.notificationLog.create({
      data: {
        clientId: clientId ?? null,
        type,
        channel: "whatsapp",
        phone,
        message,
        status,
        errorMsg: errorMsg ?? null,
        sentAt: status === "sent" ? new Date() : null,
      },
    });
  } catch (e) {
    // Never let logging failure break the main flow
    console.error("[WhatsApp] Failed to log notification:", e);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Pre-built message templates — keeps message format consistent
// ─────────────────────────────────────────────────────────────────────────────

const STUDIO = process.env.NEXT_PUBLIC_STUDIO_NAME ?? "The Movement Studio";

export const messages = {
  bookingConfirmed: (name: string, className: string, dateTime: string) =>
    `Hi ${name}! ✅ Your booking is confirmed.\n\n📍 *${STUDIO}*\n🧘 Class: *${className}*\n🕒 ${dateTime}\n\nSee you on the mat! 🌿`,

  bookingCancelled: (name: string, className: string, dateTime: string) =>
    `Hi ${name}, your booking for *${className}* on ${dateTime} has been cancelled.\n\nIf you need to rebook, visit your member portal. 🌿\n\n– ${STUDIO}`,

  classCancelled: (name: string, className: string, dateTime: string) =>
    `Hi ${name}, we're sorry — *${className}* on ${dateTime} has been cancelled by the studio.\n\nYour credit has been returned automatically. We apologise for any inconvenience! 🙏\n\n– ${STUDIO}`,

  waitlistPromoted: (name: string, className: string, dateTime: string) =>
    `Great news, ${name}! 🎉 A spot opened up for *${className}* on ${dateTime}.\n\nYou've been moved off the waitlist and your booking is confirmed!\n\n– ${STUDIO}`,

  membershipExpiringSoon: (name: string, daysLeft: number, packageName: string) =>
    `Hi ${name}, your *${packageName}* membership expires in *${daysLeft} day${daysLeft !== 1 ? "s" : ""}*.\n\nRenew now to keep your classes going! 🌿\n\n– ${STUDIO}`,

  membershipExpired: (name: string, packageName: string) =>
    `Hi ${name}, your *${packageName}* membership has expired.\n\nRenew today to book your next class! 🌿\n\n– ${STUDIO}`,

  paymentDue: (name: string, amount: string, packageName: string, dueDate: string) =>
    `Hi ${name}, a payment of *${amount}* is due for your *${packageName}* on ${dueDate}.\n\nPlease settle this to keep your membership active.\n\n– ${STUDIO}`,

  paymentOverdue: (name: string, amount: string, packageName: string, daysPast: number) =>
    `Hi ${name}, your payment of *${amount}* for *${packageName}* is *${daysPast} day${daysPast !== 1 ? "s" : ""} overdue*.\n\nPlease contact us to avoid suspension of your membership.\n\n– ${STUDIO}`,

  workshopPromo: (name: string, workshopName: string, date: string, spotsLeft: number) =>
    `Hi ${name}! 🌟 Join us for *${workshopName}* on ${date}.\n\nOnly *${spotsLeft} spot${spotsLeft !== 1 ? "s" : ""}* remaining! Book now in your member portal.\n\n– ${STUDIO}`,

  instructorChange: (name: string, className: string, dateTime: string, newInstructor: string) =>
    `Hi ${name}, heads up! The instructor for *${className}* on ${dateTime} has changed to *${newInstructor}*.\n\nAll other details remain the same.\n\n– ${STUDIO}`,

  welcomeMessage: (name: string, packageName: string) =>
    `Welcome to ${STUDIO}, ${name}! 🌿\n\nYour *${packageName}* is now active. You're ready to book your first class.\n\nSee you soon! 💚`,

  testMessage: () =>
    `✅ WhatsApp notifications are working!\n\nThis is a test message from *${STUDIO}* management system. Everything looks good! 🌿`,
};

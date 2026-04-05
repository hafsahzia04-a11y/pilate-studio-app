// ─────────────────────────────────────────────────────────────────────────────
// Audit Log Helper
// Every important change in the system creates an immutable audit record.
// This protects against staff mistakes and disputes.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from "@/lib/prisma";

interface AuditParams {
  actorId?: string;       // The user making the change (null = system/cron)
  action: string;         // e.g. 'booking.created', 'package.price_changed'
  entityType: string;     // e.g. 'booking', 'client_package', 'payment'
  entityId: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export async function audit(params: AuditParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: params.actorId ?? null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        oldValue: (params.oldValue ?? undefined) as never,
        newValue: (params.newValue ?? undefined) as never,
        ipAddress: params.ipAddress ?? null,
        userAgent: params.userAgent ?? null,
      },
    });
  } catch (e) {
    // Audit log failure should never break the main operation.
    // Log to console so it's visible in Vercel logs.
    console.error("[Audit] Failed to write audit log:", e, params);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Common audit action constants — keeps naming consistent across the codebase
// ─────────────────────────────────────────────────────────────────────────────

export const AUDIT_ACTIONS = {
  // Bookings
  BOOKING_CREATED: "booking.created",
  BOOKING_CANCELLED: "booking.cancelled",
  BOOKING_NO_SHOW: "booking.no_show",
  BOOKING_ATTENDED: "booking.attended",
  BOOKING_WAITLISTED: "booking.waitlisted",
  BOOKING_PROMOTED: "booking.promoted_from_waitlist",

  // Credits
  CREDIT_DEDUCTED: "credit.deducted",
  CREDIT_RESTORED: "credit.restored",
  CREDIT_MANUALLY_ADJUSTED: "credit.manually_adjusted",

  // Packages
  PACKAGE_CREATED: "package.created",
  PACKAGE_UPDATED: "package.updated",
  PACKAGE_ARCHIVED: "package.archived",
  CLIENT_PACKAGE_PURCHASED: "client_package.purchased",
  CLIENT_PACKAGE_PAUSED: "client_package.paused",
  CLIENT_PACKAGE_RESUMED: "client_package.resumed",
  CLIENT_PACKAGE_CANCELLED: "client_package.cancelled",
  CLIENT_PACKAGE_VALIDITY_EXTENDED: "client_package.validity_extended",

  // Payments
  PAYMENT_RECORDED: "payment.recorded",
  PAYMENT_UPDATED: "payment.updated",
  PAYMENT_REFUNDED: "payment.refunded",
  PAYMENT_STATUS_CHANGED: "payment.status_changed",

  // Classes
  CLASS_SESSION_CREATED: "class_session.created",
  CLASS_SESSION_UPDATED: "class_session.updated",
  CLASS_SESSION_CANCELLED: "class_session.cancelled",
  INSTRUCTOR_CHANGED: "class_session.instructor_changed",

  // Clients
  CLIENT_CREATED: "client.created",
  CLIENT_UPDATED: "client.updated",
  CLIENT_SUSPENDED: "client.suspended",
  CLIENT_ACTIVATED: "client.activated",

  // Products / Inventory
  PRODUCT_REDEEMED: "product.redeemed",
  PRODUCT_PURCHASED: "product.purchased",
  INVENTORY_ADJUSTED: "inventory.adjusted",

  // Settings
  SETTING_CHANGED: "setting.changed",

  // Notifications
  WHATSAPP_SENT: "notification.whatsapp_sent",

  // Instructors
  INSTRUCTOR_CREATED: "instructor.created",
  INSTRUCTOR_UPDATED: "instructor.updated",
  SALARY_RECORD_CREATED: "instructor.salary_record_created",
  SALARY_PAYMENT_RECORDED: "instructor.salary_payment_recorded",
  REFERRAL_ADDED: "instructor.referral_added",
  REFERRAL_STATUS_UPDATED: "instructor.referral_status_updated",
  CLASS_ATTENDANCE_RECORDED: "class_session.attendance_recorded",
} as const;

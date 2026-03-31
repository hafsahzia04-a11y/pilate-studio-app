-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('founder', 'staff', 'instructor', 'client');

-- CreateEnum
CREATE TYPE "public"."UserStatus" AS ENUM ('active', 'inactive', 'suspended');

-- CreateEnum
CREATE TYPE "public"."PackageType" AS ENUM ('membership', 'pack', 'drop_in', 'founding');

-- CreateEnum
CREATE TYPE "public"."ClientPackageStatus" AS ENUM ('active', 'expired', 'paused', 'cancelled', 'pending_payment');

-- CreateEnum
CREATE TYPE "public"."PaymentStatus" AS ENUM ('paid', 'partial', 'unpaid', 'overdue', 'refunded');

-- CreateEnum
CREATE TYPE "public"."PaymentMethod" AS ENUM ('cash', 'card', 'bank_transfer', 'online', 'other');

-- CreateEnum
CREATE TYPE "public"."BookingStatus" AS ENUM ('confirmed', 'attended', 'cancelled', 'late_cancelled', 'no_show', 'waitlisted');

-- CreateEnum
CREATE TYPE "public"."WaitlistStatus" AS ENUM ('waiting', 'promoted', 'cancelled', 'expired');

-- CreateEnum
CREATE TYPE "public"."SessionStatus" AS ENUM ('scheduled', 'cancelled', 'completed');

-- CreateEnum
CREATE TYPE "public"."ProductTransactionType" AS ENUM ('purchased', 'complimentary', 'adjusted');

-- CreateEnum
CREATE TYPE "public"."NotificationChannel" AS ENUM ('whatsapp', 'email', 'sms');

-- CreateEnum
CREATE TYPE "public"."NotificationStatus" AS ENUM ('pending', 'sent', 'failed');

-- CreateEnum
CREATE TYPE "public"."FreezStatus" AS ENUM ('active', 'lifted', 'expired');

-- CreateEnum
CREATE TYPE "public"."PayoutType" AS ENUM ('per_class', 'hourly', 'revenue_share', 'fixed_monthly');

-- CreateTable
CREATE TABLE "public"."profiles" (
    "id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "role" "public"."UserRole" NOT NULL DEFAULT 'client',
    "status" "public"."UserStatus" NOT NULL DEFAULT 'active',
    "avatar_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."client_profiles" (
    "id" UUID NOT NULL,
    "date_of_birth" DATE,
    "gender" TEXT,
    "emergency_contact_name" TEXT,
    "emergency_contact_phone" TEXT,
    "medical_notes" TEXT,
    "injury_notes" TEXT,
    "student_id_url" TEXT,
    "waiver_signed_at" TIMESTAMP(3),
    "membership_agreement_url" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "referral_code" TEXT,
    "staff_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."instructor_profiles" (
    "id" UUID NOT NULL,
    "bio" TEXT,
    "specializations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "payout_type" "public"."PayoutType" NOT NULL DEFAULT 'per_class',
    "payout_rate" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instructor_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."class_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#6B8F6B',
    "icon" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "class_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."class_templates" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "description" TEXT,
    "default_duration_mins" INTEGER NOT NULL DEFAULT 60,
    "buffer_time_mins" INTEGER NOT NULL DEFAULT 30,
    "uses_credits" BOOLEAN NOT NULL DEFAULT true,
    "is_workshop" BOOLEAN NOT NULL DEFAULT false,
    "workshop_price" DECIMAL(10,2),
    "workshop_discount_applies" BOOLEAN NOT NULL DEFAULT true,
    "beverage_perk_applies" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "class_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."recurring_rules" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "instructor_id" UUID NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "start_time" TEXT NOT NULL,
    "duration_mins" INTEGER NOT NULL DEFAULT 60,
    "room" TEXT,
    "capacity" INTEGER NOT NULL DEFAULT 12,
    "starts_on" DATE NOT NULL,
    "ends_on" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."class_sessions" (
    "id" TEXT NOT NULL,
    "template_id" TEXT,
    "recurring_rule_id" TEXT,
    "title" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "description" TEXT,
    "instructor_id" UUID NOT NULL,
    "substitute_instructor_id" UUID,
    "room" TEXT,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3) NOT NULL,
    "duration_mins" INTEGER NOT NULL DEFAULT 60,
    "buffer_time_mins" INTEGER NOT NULL DEFAULT 30,
    "capacity" INTEGER NOT NULL DEFAULT 12,
    "uses_credits" BOOLEAN NOT NULL DEFAULT true,
    "is_workshop" BOOLEAN NOT NULL DEFAULT false,
    "workshop_price" DECIMAL(10,2),
    "price_override" DECIMAL(10,2),
    "workshop_discount_applies" BOOLEAN NOT NULL DEFAULT true,
    "beverage_perk_applies" BOOLEAN NOT NULL DEFAULT true,
    "status" "public"."SessionStatus" NOT NULL DEFAULT 'scheduled',
    "cancellation_reason" TEXT,
    "cancelled_at" TIMESTAMP(3),
    "cancelled_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "class_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."packages" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "public"."PackageType" NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "class_credits" INTEGER NOT NULL,
    "validity_days" INTEGER NOT NULL,
    "guest_passes_per_period" INTEGER NOT NULL DEFAULT 0,
    "workshop_discount_percent" INTEGER NOT NULL DEFAULT 0,
    "drinks_per_period" INTEGER NOT NULL DEFAULT 0,
    "booking_window_hours" INTEGER,
    "priority_booking" BOOLEAN NOT NULL DEFAULT false,
    "min_commitment_months" INTEGER NOT NULL DEFAULT 0,
    "price_lock_months" INTEGER NOT NULL DEFAULT 0,
    "max_quantity" INTEGER,
    "sold_count" INTEGER NOT NULL DEFAULT 0,
    "requires_student_id" BOOLEAN NOT NULL DEFAULT false,
    "is_founding" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."client_packages" (
    "id" TEXT NOT NULL,
    "client_id" UUID NOT NULL,
    "package_id" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "expiry_date" DATE NOT NULL,
    "renewal_date" DATE,
    "total_credits" INTEGER NOT NULL,
    "used_credits" INTEGER NOT NULL DEFAULT 0,
    "remaining_credits" INTEGER NOT NULL,
    "guest_passes_remaining" INTEGER NOT NULL DEFAULT 0,
    "drinks_remaining" INTEGER NOT NULL DEFAULT 0,
    "last_perk_reset_date" DATE,
    "locked_price" DECIMAL(10,2),
    "lock_expires_at" DATE,
    "amount_paid" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "amount_due" DECIMAL(10,2) NOT NULL,
    "payment_status" "public"."PaymentStatus" NOT NULL DEFAULT 'unpaid',
    "payment_due_date" DATE,
    "status" "public"."ClientPackageStatus" NOT NULL DEFAULT 'pending_payment',
    "pause_start" DATE,
    "pause_end" DATE,
    "pause_reason" TEXT,
    "original_expiry_before_pause" DATE,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" UUID,

    CONSTRAINT "client_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."bookings" (
    "id" TEXT NOT NULL,
    "client_id" UUID NOT NULL,
    "class_session_id" TEXT NOT NULL,
    "client_package_id" TEXT,
    "status" "public"."BookingStatus" NOT NULL DEFAULT 'confirmed',
    "credit_deducted" BOOLEAN NOT NULL DEFAULT false,
    "credit_restored" BOOLEAN NOT NULL DEFAULT false,
    "is_guest_booking" BOOLEAN NOT NULL DEFAULT false,
    "guest_name" TEXT,
    "guest_phone" TEXT,
    "workshop_cash_amount" DECIMAL(10,2),
    "workshop_discount_applied" DECIMAL(10,2),
    "notes" TEXT,
    "cancellation_reason" TEXT,
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."waitlist_entries" (
    "id" TEXT NOT NULL,
    "class_session_id" TEXT NOT NULL,
    "client_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "status" "public"."WaitlistStatus" NOT NULL DEFAULT 'waiting',
    "promoted_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "waitlist_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."attendance_logs" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "class_session_id" TEXT NOT NULL,
    "check_in_time" TIMESTAMP(3),
    "marked_by_id" UUID,
    "marked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "attendance_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."payments" (
    "id" TEXT NOT NULL,
    "client_id" UUID NOT NULL,
    "client_package_id" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "discount_applied" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "tax_applied" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "net_amount" DECIMAL(10,2) NOT NULL,
    "payment_method" "public"."PaymentMethod" NOT NULL DEFAULT 'cash',
    "status" "public"."PaymentStatus" NOT NULL DEFAULT 'unpaid',
    "due_date" DATE,
    "paid_at" TIMESTAMP(3),
    "reference_number" TEXT,
    "notes" TEXT,
    "recorded_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "stock_quantity" INTEGER NOT NULL DEFAULT 0,
    "low_stock_threshold" INTEGER NOT NULL DEFAULT 5,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "image_url" TEXT,
    "category" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."product_transactions" (
    "id" TEXT NOT NULL,
    "client_id" UUID NOT NULL,
    "product_id" TEXT NOT NULL,
    "client_package_id" TEXT,
    "type" "public"."ProductTransactionType" NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "total_amount" DECIMAL(10,2) NOT NULL,
    "processed_by_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."membership_freezes" (
    "id" TEXT NOT NULL,
    "client_id" UUID NOT NULL,
    "client_package_id" TEXT NOT NULL,
    "freeze_start" DATE NOT NULL,
    "freeze_end" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "original_expiry" DATE NOT NULL,
    "new_expiry" DATE NOT NULL,
    "approved_by_id" UUID,
    "status" "public"."FreezStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "membership_freezes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."referrals" (
    "id" TEXT NOT NULL,
    "referrer_id" UUID NOT NULL,
    "referred_id" UUID NOT NULL,
    "reward_type" TEXT NOT NULL,
    "reward_value" DECIMAL(10,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "applied_at" TIMESTAMP(3),

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."studio_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "updated_by_id" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "studio_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "public"."audit_logs" (
    "id" TEXT NOT NULL,
    "actor_id" UUID,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "old_value" JSONB,
    "new_value" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."notification_logs" (
    "id" TEXT NOT NULL,
    "client_id" UUID,
    "type" TEXT NOT NULL,
    "channel" "public"."NotificationChannel" NOT NULL DEFAULT 'whatsapp',
    "phone" TEXT,
    "email" TEXT,
    "message" TEXT NOT NULL,
    "status" "public"."NotificationStatus" NOT NULL DEFAULT 'pending',
    "error_msg" TEXT,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."instructor_payouts" (
    "id" TEXT NOT NULL,
    "instructor_id" UUID NOT NULL,
    "class_session_id" TEXT NOT NULL,
    "payout_type" "public"."PayoutType" NOT NULL,
    "base_rate" DECIMAL(10,2) NOT NULL,
    "attendee_count" INTEGER NOT NULL,
    "total_amount" DECIMAL(10,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paid_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "instructor_payouts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "profiles_email_key" ON "public"."profiles"("email");

-- CreateIndex
CREATE UNIQUE INDEX "client_profiles_referral_code_key" ON "public"."client_profiles"("referral_code");

-- CreateIndex
CREATE UNIQUE INDEX "class_categories_name_key" ON "public"."class_categories"("name");

-- CreateIndex
CREATE INDEX "class_sessions_start_time_idx" ON "public"."class_sessions"("start_time");

-- CreateIndex
CREATE INDEX "class_sessions_instructor_id_idx" ON "public"."class_sessions"("instructor_id");

-- CreateIndex
CREATE INDEX "class_sessions_status_idx" ON "public"."class_sessions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "packages_name_key" ON "public"."packages"("name");

-- CreateIndex
CREATE INDEX "client_packages_client_id_idx" ON "public"."client_packages"("client_id");

-- CreateIndex
CREATE INDEX "client_packages_status_idx" ON "public"."client_packages"("status");

-- CreateIndex
CREATE INDEX "client_packages_expiry_date_idx" ON "public"."client_packages"("expiry_date");

-- CreateIndex
CREATE INDEX "client_packages_payment_status_idx" ON "public"."client_packages"("payment_status");

-- CreateIndex
CREATE INDEX "bookings_class_session_id_idx" ON "public"."bookings"("class_session_id");

-- CreateIndex
CREATE INDEX "bookings_client_id_idx" ON "public"."bookings"("client_id");

-- CreateIndex
CREATE INDEX "bookings_status_idx" ON "public"."bookings"("status");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_client_id_class_session_id_key" ON "public"."bookings"("client_id", "class_session_id");

-- CreateIndex
CREATE INDEX "waitlist_entries_class_session_id_status_position_idx" ON "public"."waitlist_entries"("class_session_id", "status", "position");

-- CreateIndex
CREATE UNIQUE INDEX "waitlist_entries_class_session_id_client_id_key" ON "public"."waitlist_entries"("class_session_id", "client_id");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_logs_booking_id_key" ON "public"."attendance_logs"("booking_id");

-- CreateIndex
CREATE INDEX "attendance_logs_class_session_id_idx" ON "public"."attendance_logs"("class_session_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_reference_number_key" ON "public"."payments"("reference_number");

-- CreateIndex
CREATE INDEX "payments_client_id_idx" ON "public"."payments"("client_id");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "public"."payments"("status");

-- CreateIndex
CREATE INDEX "payments_due_date_idx" ON "public"."payments"("due_date");

-- CreateIndex
CREATE UNIQUE INDEX "products_name_key" ON "public"."products"("name");

-- CreateIndex
CREATE INDEX "product_transactions_client_id_idx" ON "public"."product_transactions"("client_id");

-- CreateIndex
CREATE INDEX "product_transactions_product_id_idx" ON "public"."product_transactions"("product_id");

-- CreateIndex
CREATE INDEX "membership_freezes_client_package_id_idx" ON "public"."membership_freezes"("client_package_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_idx" ON "public"."audit_logs"("actor_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "public"."audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "public"."audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "notification_logs_client_id_idx" ON "public"."notification_logs"("client_id");

-- CreateIndex
CREATE INDEX "notification_logs_status_idx" ON "public"."notification_logs"("status");

-- AddForeignKey
ALTER TABLE "public"."client_profiles" ADD CONSTRAINT "client_profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."instructor_profiles" ADD CONSTRAINT "instructor_profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."class_templates" ADD CONSTRAINT "class_templates_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."class_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."recurring_rules" ADD CONSTRAINT "recurring_rules_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."class_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."recurring_rules" ADD CONSTRAINT "recurring_rules_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."class_sessions" ADD CONSTRAINT "class_sessions_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."class_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."class_sessions" ADD CONSTRAINT "class_sessions_recurring_rule_id_fkey" FOREIGN KEY ("recurring_rule_id") REFERENCES "public"."recurring_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."class_sessions" ADD CONSTRAINT "class_sessions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."class_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."class_sessions" ADD CONSTRAINT "class_sessions_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."class_sessions" ADD CONSTRAINT "class_sessions_substitute_instructor_id_fkey" FOREIGN KEY ("substitute_instructor_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."client_packages" ADD CONSTRAINT "client_packages_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."client_packages" ADD CONSTRAINT "client_packages_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bookings" ADD CONSTRAINT "bookings_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bookings" ADD CONSTRAINT "bookings_class_session_id_fkey" FOREIGN KEY ("class_session_id") REFERENCES "public"."class_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bookings" ADD CONSTRAINT "bookings_client_package_id_fkey" FOREIGN KEY ("client_package_id") REFERENCES "public"."client_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."waitlist_entries" ADD CONSTRAINT "waitlist_entries_class_session_id_fkey" FOREIGN KEY ("class_session_id") REFERENCES "public"."class_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."waitlist_entries" ADD CONSTRAINT "waitlist_entries_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."attendance_logs" ADD CONSTRAINT "attendance_logs_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."attendance_logs" ADD CONSTRAINT "attendance_logs_class_session_id_fkey" FOREIGN KEY ("class_session_id") REFERENCES "public"."class_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."attendance_logs" ADD CONSTRAINT "attendance_logs_marked_by_id_fkey" FOREIGN KEY ("marked_by_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_client_package_id_fkey" FOREIGN KEY ("client_package_id") REFERENCES "public"."client_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."product_transactions" ADD CONSTRAINT "product_transactions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."product_transactions" ADD CONSTRAINT "product_transactions_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."product_transactions" ADD CONSTRAINT "product_transactions_client_package_id_fkey" FOREIGN KEY ("client_package_id") REFERENCES "public"."client_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."product_transactions" ADD CONSTRAINT "product_transactions_processed_by_id_fkey" FOREIGN KEY ("processed_by_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."membership_freezes" ADD CONSTRAINT "membership_freezes_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."membership_freezes" ADD CONSTRAINT "membership_freezes_client_package_id_fkey" FOREIGN KEY ("client_package_id") REFERENCES "public"."client_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."referrals" ADD CONSTRAINT "referrals_referrer_id_fkey" FOREIGN KEY ("referrer_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."referrals" ADD CONSTRAINT "referrals_referred_id_fkey" FOREIGN KEY ("referred_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notification_logs" ADD CONSTRAINT "notification_logs_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;


// ─────────────────────────────────────────────────────────────────────────────
// Prisma Seed — creates initial data for The Movement Studio
// Run: npm run db:seed
// ─────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

const prisma = new PrismaClient();

// Admin Supabase client — used to create auth users
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
  console.log("🌱 Starting seed...");

  // ── 1. Create founder auth user ──────────────────────────────────────────
  console.log("Creating founder account...");

  const founderEmail = "founder@themovementstudio.com";
  const founderPassword = "Founder@2024!"; // Change this immediately after first login

  const { data: founderAuth, error: founderAuthError } =
    await supabase.auth.admin.createUser({
      email: founderEmail,
      password: founderPassword,
      email_confirm: true,
      user_metadata: { full_name: "Studio Founder", role: "founder" },
    });

  if (founderAuthError && !founderAuthError.message.includes("already registered")) {
    throw new Error(`Failed to create founder: ${founderAuthError.message}`);
  }

  const founderId =
    founderAuth?.user?.id ??
    (await prisma.profile.findUnique({ where: { email: founderEmail } }))?.id;

  if (!founderId) throw new Error("Could not get founder ID");

  await prisma.profile.upsert({
    where: { id: founderId },
    update: {},
    create: {
      id: founderId,
      email: founderEmail,
      fullName: "Studio Founder",
      role: "founder",
      status: "active",
    },
  });

  console.log(`✅ Founder: ${founderEmail} / ${founderPassword}`);

  // ── 2. Create a staff member ──────────────────────────────────────────────
  const staffEmail = "staff@themovementstudio.com";
  const { data: staffAuth } = await supabase.auth.admin.createUser({
    email: staffEmail,
    password: "Staff@2024!",
    email_confirm: true,
    user_metadata: { full_name: "Reception Staff", role: "staff" },
  });

  const staffId =
    staffAuth?.user?.id ??
    (await prisma.profile.findUnique({ where: { email: staffEmail } }))?.id;

  if (staffId) {
    await prisma.profile.upsert({
      where: { id: staffId },
      update: {},
      create: {
        id: staffId,
        email: staffEmail,
        fullName: "Reception Staff",
        role: "staff",
        status: "active",
      },
    });
    console.log(`✅ Staff: ${staffEmail} / Staff@2024!`);
  }

  // ── 3. Create an instructor ───────────────────────────────────────────────
  const instructorEmail = "instructor@themovementstudio.com";
  const { data: instrAuth } = await supabase.auth.admin.createUser({
    email: instructorEmail,
    password: "Instructor@2024!",
    email_confirm: true,
    user_metadata: { full_name: "Sarah Chen", role: "instructor" },
  });

  const instructorId =
    instrAuth?.user?.id ??
    (await prisma.profile.findUnique({ where: { email: instructorEmail } }))?.id;

  if (instructorId) {
    await prisma.profile.upsert({
      where: { id: instructorId },
      update: {},
      create: {
        id: instructorId,
        email: instructorEmail,
        fullName: "Sarah Chen",
        role: "instructor",
        status: "active",
        instructorProfile: {
          create: {
            bio: "Certified yoga and pilates instructor with 8 years experience.",
            specializations: ["yoga", "mat_pilates", "yogalates"],
            payoutType: "per_class",
            payoutRate: 150,
          },
        },
      },
    });
    console.log(`✅ Instructor: ${instructorEmail} / Instructor@2024!`);
  }

  // ── 4. Class categories ───────────────────────────────────────────────────
  console.log("Creating class categories...");

  const categories = await Promise.all([
    prisma.classCategory.upsert({
      where: { name: "Yoga" },
      update: {},
      create: { name: "Yoga", color: "#6B8F6B", icon: "🧘", sortOrder: 1 },
    }),
    prisma.classCategory.upsert({
      where: { name: "Yogalates" },
      update: {},
      create: { name: "Yogalates", color: "#8B9E6B", icon: "🌿", sortOrder: 2 },
    }),
    prisma.classCategory.upsert({
      where: { name: "Mat Pilates" },
      update: {},
      create: { name: "Mat Pilates", color: "#9B8B6B", icon: "✨", sortOrder: 3 },
    }),
    prisma.classCategory.upsert({
      where: { name: "Zumba" },
      update: {},
      create: { name: "Zumba", color: "#C08080", icon: "💃", sortOrder: 4 },
    }),
    prisma.classCategory.upsert({
      where: { name: "Cardio" },
      update: {},
      create: { name: "Cardio", color: "#D4A96A", icon: "❤️", sortOrder: 5 },
    }),
    prisma.classCategory.upsert({
      where: { name: "Strength" },
      update: {},
      create: { name: "Strength", color: "#7A6B9B", icon: "💪", sortOrder: 6 },
    }),
    prisma.classCategory.upsert({
      where: { name: "Mobility & Stretch" },
      update: {},
      create: { name: "Mobility & Stretch", color: "#6B9BA0", icon: "🌊", sortOrder: 7 },
    }),
    prisma.classCategory.upsert({
      where: { name: "Meditation & Recovery" },
      update: {},
      create: { name: "Meditation & Recovery", color: "#A09B7A", icon: "🌙", sortOrder: 8 },
    }),
    prisma.classCategory.upsert({
      where: { name: "Beginner & Foundation" },
      update: {},
      create: { name: "Beginner & Foundation", color: "#7A9BA0", icon: "🌱", sortOrder: 9 },
    }),
    prisma.classCategory.upsert({
      where: { name: "Sunday Workshop" },
      update: {},
      create: { name: "Sunday Workshop", color: "#B8895A", icon: "⭐", sortOrder: 10 },
    }),
  ]);

  console.log(`✅ ${categories.length} class categories created`);

  // ── 5. Membership packages ────────────────────────────────────────────────
  console.log("Creating packages...");

  const packagesToCreate = [
    {
      name: "Drop-In",
      type: "drop_in" as const,
      description: "Single class. Try us out!",
      price: 75,
      classCredits: 1,
      validityDays: 1,
      sortOrder: 0,
    },
    {
      name: "Essential",
      type: "membership" as const,
      description: "8 classes per month. Perfect for getting started.",
      price: 450,
      classCredits: 8,
      validityDays: 30,
      sortOrder: 1,
    },
    {
      name: "Core",
      type: "membership" as const,
      description: "12 classes per month with guest pass and workshop discount.",
      price: 650,
      classCredits: 12,
      validityDays: 30,
      guestPassesPerPeriod: 1,
      workshopDiscountPercent: 10,
      bookingWindowHours: 72,
      sortOrder: 2,
    },
    {
      name: "Premium",
      type: "membership" as const,
      description: "16 classes + 2 guest passes + complimentary wellness shots + priority booking.",
      price: 900,
      classCredits: 16,
      validityDays: 30,
      guestPassesPerPeriod: 2,
      workshopDiscountPercent: 20,
      drinksPerPeriod: 2,
      priorityBooking: true,
      sortOrder: 3,
    },
    {
      name: "Student Membership",
      type: "membership" as const,
      description: "8 classes per month for students (ID verification required).",
      price: 300,
      classCredits: 8,
      validityDays: 30,
      requiresStudentId: true,
      sortOrder: 4,
    },
    {
      name: "Founding Member",
      type: "founding" as const,
      description: "Exclusive founding rate. 12 classes/month, price locked for 6 months. Limited to 50 spots.",
      price: 550,
      classCredits: 12,
      validityDays: 30,
      guestPassesPerPeriod: 1,
      workshopDiscountPercent: 10,
      priorityBooking: true,
      minCommitmentMonths: 3,
      priceLockMonths: 6,
      maxQuantity: 50,
      isFounding: true,
      sortOrder: 5,
    },
    {
      name: "5 Class Pack",
      type: "pack" as const,
      description: "5 classes, valid for 60 days. No expiry pressure!",
      price: 350,
      classCredits: 5,
      validityDays: 60,
      sortOrder: 6,
    },
    {
      name: "10 Class Pack",
      type: "pack" as const,
      description: "10 classes, valid for 90 days.",
      price: 650,
      classCredits: 10,
      validityDays: 90,
      sortOrder: 7,
    },
  ];

  for (const pkg of packagesToCreate) {
    await prisma.package.upsert({
      where: { name: pkg.name },
      update: {},
      create: {
        ...pkg,
        guestPassesPerPeriod: pkg.guestPassesPerPeriod ?? 0,
        workshopDiscountPercent: pkg.workshopDiscountPercent ?? 0,
        drinksPerPeriod: pkg.drinksPerPeriod ?? 0,
        priorityBooking: pkg.priorityBooking ?? false,
        minCommitmentMonths: pkg.minCommitmentMonths ?? 0,
        priceLockMonths: pkg.priceLockMonths ?? 0,
        requiresStudentId: pkg.requiresStudentId ?? false,
        isFounding: pkg.isFounding ?? false,
        isActive: true,
        isVisible: true,
      },
    });
  }

  console.log(`✅ ${packagesToCreate.length} packages created`);

  // ── 6. Wellness products ──────────────────────────────────────────────────
  console.log("Creating products...");

  const products = [
    { name: "Immunity Wellness Shot", price: 25, stockQuantity: 30, category: "wellness_shot" },
    { name: "Energy Wellness Shot", price: 25, stockQuantity: 25, category: "wellness_shot" },
    { name: "Matcha Latte", price: 22, stockQuantity: 20, category: "beverage" },
    { name: "Coconut Water", price: 15, stockQuantity: 40, category: "beverage" },
    { name: "Protein Bar", price: 18, stockQuantity: 15, category: "retail" },
  ];

  for (const p of products) {
    await prisma.product.upsert({
      where: { name: p.name },
      update: {},
      create: { ...p, lowStockThreshold: 5, isActive: true },
    });
  }

  console.log(`✅ ${products.length} products created`);

  // ── 7. Studio settings defaults ───────────────────────────────────────────
  console.log("Creating studio settings...");

  const settingsToSet = [
    { key: "max_class_capacity", value: 12, description: "Maximum participants per class" },
    { key: "max_workshop_capacity", value: 12, description: "Maximum participants per workshop" },
    { key: "default_class_duration_mins", value: 60, description: "Default class duration in minutes" },
    { key: "default_buffer_time_mins", value: 30, description: "Buffer/cleaning time between classes" },
    { key: "late_cancel_cutoff_hours", value: 12, description: "Hours before class to cancel without losing credit" },
    { key: "no_show_loses_credit", value: true, description: "No-shows lose their class credit" },
    { key: "late_cancel_loses_credit", value: true, description: "Late cancellations lose their credit" },
    { key: "credit_deduct_on", value: "booking", description: "When to deduct credit: booking or attendance" },
    { key: "waitlist_auto_promote", value: true, description: "Automatically promote from waitlist when spot opens" },
    { key: "waitlist_promotion_window_hours", value: 2, description: "Hours client has to confirm after waitlist promotion" },
    { key: "standard_booking_window_hours", value: 168, description: "How far in advance clients can book (hours)" },
    { key: "whatsapp_enabled", value: true, description: "Enable WhatsApp notifications" },
    { key: "notify_on_booking", value: true, description: "Send WhatsApp on booking confirmation" },
    { key: "notify_on_cancellation", value: true, description: "Send WhatsApp on booking cancellation" },
    { key: "notify_expiry_days", value: [7, 3, 1], description: "Days before expiry to send reminder" },
    { key: "notify_overdue_days", value: [1, 7], description: "Days after due date to send overdue reminder" },
    { key: "studio_timezone", value: "Asia/Dubai", description: "Studio timezone" },
    { key: "currency", value: "AED", description: "Display currency code" },
    { key: "tax_percent", value: 0, description: "Tax percentage (0 = no tax)" },
    { key: "founding_member_limit", value: 50, description: "Maximum founding member spots" },
  ];

  for (const s of settingsToSet) {
    await prisma.studioSetting.upsert({
      where: { key: s.key },
      update: {},
      create: { key: s.key, value: s.value, description: s.description },
    });
  }

  console.log(`✅ ${settingsToSet.length} studio settings configured`);

  // ── 8. Sample class sessions (next 7 days) ────────────────────────────────
  if (instructorId) {
    console.log("Creating sample class sessions...");

    const yoga = categories.find((c) => c.name === "Yoga")!;
    const pilates = categories.find((c) => c.name === "Mat Pilates")!;
    const mobility = categories.find((c) => c.name === "Mobility & Stretch")!;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const classTimes = [
      { hour: 7, minute: 0 }, // 7:00 AM
      { hour: 9, minute: 0 }, // 9:00 AM
      { hour: 17, minute: 30 }, // 5:30 PM
      { hour: 19, minute: 0 }, // 7:00 PM
    ];

    const classTemplates = [
      { title: "Morning Flow Yoga", categoryId: yoga.id },
      { title: "Mat Pilates Core", categoryId: pilates.id },
      { title: "Sunset Yoga", categoryId: yoga.id },
      { title: "Mobility & Stretch", categoryId: mobility.id },
    ];

    // Create sessions for Mon-Fri of the current week
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const date = new Date(today);
      date.setDate(today.getDate() + dayOffset);
      const dow = date.getDay();
      if (dow === 0) continue; // Skip Sunday (workshops only)

      const template = classTemplates[dayOffset % classTemplates.length];
      const time = classTimes[dayOffset % classTimes.length];

      const start = new Date(date);
      start.setHours(time.hour, time.minute, 0, 0);
      const end = new Date(start);
      end.setMinutes(end.getMinutes() + 60);

      await prisma.classSession.create({
        data: {
          title: template.title,
          categoryId: template.categoryId,
          instructorId,
          startTime: start,
          endTime: end,
          durationMins: 60,
          bufferTimeMins: 30,
          capacity: 12,
          usesCredits: true,
          isWorkshop: false,
          status: "scheduled",
        },
      });
    }

    console.log("✅ Sample class sessions created");
  }

  console.log("\n🎉 Seed complete!\n");
  console.log("─────────────────────────────────────────────────");
  console.log("LOGIN CREDENTIALS:");
  console.log(`Founder:    ${founderEmail}    password: Founder@2024!`);
  console.log(`Staff:      staff@themovementstudio.com    password: Staff@2024!`);
  console.log(`Instructor: instructor@themovementstudio.com    password: Instructor@2024!`);
  console.log("─────────────────────────────────────────────────");
  console.log("⚠️  IMPORTANT: Change all passwords immediately after first login!");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

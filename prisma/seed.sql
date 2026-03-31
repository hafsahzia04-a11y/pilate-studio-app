-- ─────────────────────────────────────────────────────────────────────────────
-- SEED DATA — Run this in Supabase SQL Editor AFTER running migration.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Class Categories ───────────────────────────────────────────────────────
INSERT INTO public.class_categories (id, name, description, color, icon, is_active, sort_order, updated_at) VALUES
  ('yoga',        'Yoga',                 'Mind-body yoga practice',                      '#7C9A7E', '🧘', true, 1,  now()),
  ('yogalates',   'Yogalates',            'Yoga + Pilates fusion',                        '#8FAF91', '🌿', true, 2,  now()),
  ('mat-pilates', 'Mat Pilates',          'Core-focused Pilates on the mat',              '#6B8F6B', '💪', true, 3,  now()),
  ('zumba',       'Zumba',               'High-energy Latin dance fitness',              '#C4956A', '💃', true, 4,  now()),
  ('cardio',      'Cardio',              'Cardiovascular conditioning',                  '#D4956A', '🏃', true, 5,  now()),
  ('strength',    'Strength',            'Resistance and strength training',             '#8B7355', '🏋️', true, 6,  now()),
  ('mobility',    'Mobility & Stretch',  'Flexibility and mobility work',               '#A8C5A0', '🤸', true, 7,  now()),
  ('meditation',  'Meditation & Recovery','Mindfulness and recovery sessions',           '#9BB5D0', '🧠', true, 8,  now()),
  ('beginner',    'Beginner & Foundation','Entry-level classes for new students',        '#C5B4E3', '⭐', true, 9,  now()),
  ('workshop',    'Sunday Workshops',    'Special weekend deep-dive workshops',          '#E8B4A0', '📚', true, 10, now())
ON CONFLICT (id) DO NOTHING;

-- ── 2. Packages ───────────────────────────────────────────────────────────────
INSERT INTO public.packages (
  id, name, type, description, price,
  class_credits, validity_days,
  guest_passes_per_period, workshop_discount_percent, drinks_per_period,
  priority_booking, min_commitment_months, price_lock_months,
  max_quantity, requires_student_id, is_founding, is_active, is_visible, sort_order,
  updated_at
) VALUES
  -- Drop-in
  ('pkg-dropin',    'Drop-In Class',       'drop_in',   'Single class, no commitment',
   75,  1,  7,   0, 0, 0, false, 0, 0, null,  false, false, true, true, 1,  now()),

  -- 5-Class Pack
  ('pkg-5pack',     '5-Class Pack',        'pack',      '5 classes, use within 60 days',
   350, 5,  60,  0, 0, 0, false, 0, 0, null,  false, false, true, true, 2,  now()),

  -- 10-Class Pack
  ('pkg-10pack',    '10-Class Pack',       'pack',      '10 classes, use within 90 days — best value pack',
   650, 10, 90,  0, 0, 0, false, 0, 0, null,  false, false, true, true, 3,  now()),

  -- Essential Membership
  ('pkg-essential', 'Essential',           'membership','8 classes/month rolling membership',
   450, 8,  30,  0, 0, 0, false, 0, 0, null,  false, false, true, true, 4,  now()),

  -- Core Membership
  ('pkg-core',      'Core',               'membership','12 classes/month + 1 guest pass + 10% workshop discount',
   650, 12, 30,  1, 10, 0, false, 0, 0, null, false, false, true, true, 5,  now()),

  -- Premium Membership
  ('pkg-premium',   'Premium',            'membership','16 classes/month + 2 guest passes + 20% workshop discount + 2 complimentary drinks + priority booking',
   900, 16, 30,  2, 20, 2, true,  0, 0, null, false, false, true, true, 6,  now()),

  -- Student Membership
  ('pkg-student',   'Student',            'membership','8 classes/month — valid student ID required',
   350, 8,  30,  0, 0, 0, false, 0, 0, null,  true,  false, true, true, 7,  now()),

  -- Founding Member
  ('pkg-founding',  'Founding Member',    'founding',  'Limited to 50 spots. 12 classes/month, 3-month commitment, price locked for 6 months',
   550, 12, 30,  1, 10, 0, false, 3, 6, 50,   false, true,  true, true, 8,  now())

ON CONFLICT (id) DO NOTHING;

-- ── 3. Studio Settings ────────────────────────────────────────────────────────
INSERT INTO public.studio_settings (key, value, description, updated_at) VALUES
  ('max_class_capacity',              '12',                   'Default max students per class',                   now()),
  ('max_workshop_capacity',           '12',                   'Max students per workshop',                        now()),
  ('default_class_duration_mins',     '60',                   'Default class duration in minutes',                now()),
  ('default_buffer_time_mins',        '30',                   'Buffer time between classes',                      now()),
  ('late_cancel_cutoff_hours',        '12',                   'Hours before class to cancel without penalty',     now()),
  ('no_show_loses_credit',            'true',                 'No-show clients lose their credit',                now()),
  ('late_cancel_loses_credit',        'true',                 'Late cancellations lose their credit',             now()),
  ('credit_deduct_on',                '"booking"',            'When to deduct credit: booking or attendance',     now()),
  ('waitlist_auto_promote',           'true',                 'Auto-promote waitlisted clients when spot opens',  now()),
  ('waitlist_promotion_window_hours', '2',                    'Hours client has to confirm waitlist promotion',   now()),
  ('standard_booking_window_hours',   '168',                  'How far ahead clients can book (hours)',           now()),
  ('whatsapp_enabled',                'true',                 'Enable WhatsApp notifications',                    now()),
  ('notify_on_booking',               'true',                 'Send WhatsApp on booking confirmation',            now()),
  ('notify_on_cancellation',          'true',                 'Send WhatsApp on cancellation',                    now()),
  ('notify_expiry_days',              '[7,3,1]',              'Days before expiry to send reminder',              now()),
  ('notify_overdue_days',             '[1,7]',                'Days after due date to send payment reminder',     now()),
  ('studio_timezone',                 '"Asia/Dubai"',         'Studio timezone',                                  now()),
  ('currency',                        '"AED"',                'Currency code',                                    now()),
  ('tax_percent',                     '5',                    'Tax percentage (VAT)',                             now()),
  ('studio_phone',                    '""',                   'Studio contact phone number',                      now()),
  ('studio_email',                    '""',                   'Studio contact email',                             now()),
  ('studio_address',                  '""',                   'Studio physical address',                          now()),
  ('founding_member_limit',           '50',                   'Max founding member spots available',              now())
ON CONFLICT (key) DO NOTHING;

-- ── 4. Wellness Products ──────────────────────────────────────────────────────
INSERT INTO public.products (id, name, description, price, stock_quantity, low_stock_threshold, is_active, category, updated_at) VALUES
  ('prod-green-shot',    'Green Wellness Shot',    'Spirulina, ginger, lemon — 60ml',              15, 30, 10, true, 'wellness_shot', now()),
  ('prod-immunity-shot', 'Immunity Booster Shot',  'Turmeric, black pepper, orange — 60ml',        15, 30, 10, true, 'wellness_shot', now()),
  ('prod-collagen-shot', 'Collagen Beauty Shot',   'Marine collagen, vitamin C, rose hip — 60ml', 20, 20, 8,  true, 'wellness_shot', now()),
  ('prod-matcha',        'Ceremonial Matcha',      'Premium grade matcha latte',                   22, 25, 8,  true, 'beverage',     now()),
  ('prod-protein',       'Protein Shake',          'Whey protein, almond milk, banana',            28, 20, 5,  true, 'beverage',     now())
ON CONFLICT (id) DO NOTHING;

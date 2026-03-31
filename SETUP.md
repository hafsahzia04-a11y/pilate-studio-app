# The Movement Studio — Complete Setup Guide

> **Who this is for:** Studio founders and managers with no coding experience.  
> **Time needed:** About 45–60 minutes for the full setup.  
> **What you'll have at the end:** A live, working web app for your studio.

---

## Overview: What We're Setting Up

| Service | What it does | Cost |
|---------|-------------|------|
| **Supabase** | Stores all your data (members, bookings, payments) | Free |
| **Vercel** | Hosts your website | Free |
| **GitHub** | Stores your code | Free |
| **CallMeBot** | Sends WhatsApp notifications | Free |

---

## STEP 1 — Create a Supabase Account (Your Database)

Supabase is where all your studio data lives — members, bookings, payments, etc.

### 1.1 Sign up
1. Go to **https://supabase.com**
2. Click **"Start your project"**
3. Sign up with your Google account or email
4. Verify your email if asked

### 1.2 Create a New Project
1. Click **"New Project"**
2. Fill in:
   - **Name:** `movement-studio` (or anything you like)
   - **Database Password:** Choose a strong password — write it down! You'll need it later.
   - **Region:** Choose the one closest to you (e.g., "Frankfurt EU" for Europe, "Singapore" for Asia)
3. Click **"Create new project"**
4. Wait 2–3 minutes for it to set up (you'll see a loading screen)

### 1.3 Get Your API Keys
1. Once loaded, click the **gear icon (Settings)** in the left sidebar
2. Click **"API"**
3. You'll see two keys — copy and save them somewhere safe:
   - **Project URL** (looks like `https://abcdefghij.supabase.co`)
   - **anon / public key** (a long string starting with `eyJ...`)
   - **service_role key** (another long string — keep this SECRET, never share it)

### 1.4 Get Your Database Connection Strings
1. Still in Settings, click **"Database"**
2. Find **"Connection string"** section
3. Choose **"URI"** format
4. Copy the **Transaction** connection string (used in Vercel)
5. Copy the **Session** connection string (used for migrations)
6. Replace `[YOUR-PASSWORD]` in each with your database password from Step 1.2

---

## STEP 2 — Set Up GitHub (Code Repository)

GitHub stores your app code. Vercel connects to GitHub to deploy your app.

### 2.1 Sign up
1. Go to **https://github.com**
2. Create a free account if you don't have one

### 2.2 Create a new repository
1. Click the **"+"** icon at top right → **"New repository"**
2. Name it: `movement-studio-app`
3. Set to **Private**
4. Click **"Create repository"**

### 2.3 Upload your code
If you received this code as a ZIP file:
1. Unzip the folder on your computer
2. In your new GitHub repository, click **"uploading an existing file"**
3. Drag all the files into the upload area
4. Scroll down and click **"Commit changes"**

Or if you're using the terminal (ask your developer to do this):
```bash
git remote add origin https://github.com/YOUR-USERNAME/movement-studio-app.git
git push -u origin main
```

---

## STEP 3 — Deploy to Vercel (Your Website Host)

Vercel makes your app live on the internet.

### 3.1 Sign up
1. Go to **https://vercel.com**
2. Click **"Sign Up"** → choose **"Continue with GitHub"**
3. Authorize Vercel to access your GitHub

### 3.2 Import your project
1. On the Vercel dashboard, click **"Add New..."** → **"Project"**
2. Find your `movement-studio-app` repository and click **"Import"**
3. **DO NOT click Deploy yet** — you need to add environment variables first

### 3.3 Add Environment Variables
This is the most important step. Click **"Environment Variables"** and add each one:

| Variable Name | Where to find it | Example |
|--------------|-----------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL | `https://abcdef.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon key | `eyJhbGciOi...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role key | `eyJhbGciOi...` |
| `DATABASE_URL` | Supabase → Settings → Database → Transaction URI | `postgresql://postgres...` |
| `DIRECT_URL` | Supabase → Settings → Database → Session URI | `postgresql://postgres...` |
| `CALLMEBOT_API_KEY` | See Step 4 below | `123456` |
| `FOUNDER_WHATSAPP_PHONE` | Your WhatsApp number | `971501234567` |
| `NEXT_PUBLIC_APP_URL` | Your Vercel URL (set after deploy) | `https://your-app.vercel.app` |
| `NEXT_PUBLIC_STUDIO_NAME` | Your studio name | `The Movement Studio` |
| `NEXT_PUBLIC_TIMEZONE` | Your timezone | `Asia/Dubai` |

**For `FOUNDER_WHATSAPP_PHONE`:** Enter your number with country code, no spaces, no plus sign.
- UAE example: `971501234567`
- UK example: `447911123456`
- India example: `919876543210`

### 3.4 Deploy
1. After adding all variables, click **"Deploy"**
2. Wait 3–5 minutes
3. You'll get a URL like `https://movement-studio-app.vercel.app`

---

## STEP 4 — Set Up WhatsApp Notifications (CallMeBot)

This gives you free WhatsApp notifications for bookings, reminders, and payments.

### 4.1 Add CallMeBot to your contacts
1. Open WhatsApp on your phone
2. Add a new contact:
   - **Name:** `CallMeBot`
   - **Number:** `+34 644 59 78 14`

### 4.2 Request your API key
1. Open WhatsApp and send a message to **CallMeBot**:
   ```
   I allow callmebot to send me messages
   ```
   (Send this exact text, nothing else)
2. Wait 1–2 minutes
3. You'll receive a reply with your **API key** (a 6-digit number)

### 4.3 Test that it works
1. Log into your app as a founder
2. Go to **Settings → Notifications**
3. Click the **"Test WhatsApp"** button
4. You should receive a WhatsApp message within 30 seconds!

### 4.4 Important notes about CallMeBot
- ✅ It's completely free
- ✅ Works for personal use
- ⚠️ Messages are sent to YOUR number by default when testing
- ⚠️ Each client needs to also activate CallMeBot with their own number to receive messages
- 💡 Alternatively, for sending to multiple clients automatically, you may upgrade to Twilio (paid) in the future

### Setting up clients to receive WhatsApp notifications
For each client who wants WhatsApp notifications:
1. They must add `+34 644 59 78 14` to their contacts as "CallMeBot"
2. They must send the message: `I allow callmebot to send me messages`
3. They receive their own API key
4. You enter their API key in their client profile in your app

> **Note:** This is the main limitation of the free CallMeBot plan. For a professional studio with many clients, consider upgrading to **Twilio** (about $15-20/month). Ask your developer to swap the WhatsApp function in `src/lib/whatsapp.ts`.

---

## STEP 5 — Set Up Your Database Schema

This creates all the tables in your database.

### Option A: Using the Vercel terminal (recommended for non-developers)
1. Go to your Vercel dashboard
2. Find your project → click **"Functions"** tab
3. This is complex for non-developers — contact your developer to run:
   ```bash
   npx prisma db push
   npm run db:seed
   ```

### Option B: Using Supabase SQL editor
1. In Supabase dashboard, click **"SQL Editor"** in the left sidebar
2. Your developer should run the migration SQL there

### What the seed creates:
After running, you'll have:
- ✅ Founder account: `founder@themovementstudio.com` / `Founder@2024!`
- ✅ Staff account: `staff@themovementstudio.com` / `Staff@2024!`
- ✅ Instructor account: `instructor@themovementstudio.com` / `Instructor@2024!`
- ✅ All 10 class categories (Yoga, Pilates, Zumba, etc.)
- ✅ All 8 membership packages with correct pricing
- ✅ 5 wellness products
- ✅ All studio settings pre-configured

**⚠️ Change all passwords immediately after first login!**

---

## STEP 6 — First Login & Initial Setup

### 6.1 Log in as Founder
1. Go to your app URL (e.g., `https://movement-studio-app.vercel.app`)
2. Log in with: `founder@themovementstudio.com` / `Founder@2024!`
3. You'll be taken to the Founder Dashboard

### 6.2 Change your password
1. Go to **Settings** (bottom of left sidebar)
2. Or use Supabase Auth → Users → select your user → change password

### 6.3 Review and update packages
1. Click **"Packages"** in the sidebar
2. Review all 8 packages — prices are set to sample values in AED
3. Click **Edit** on each to adjust prices to your actual rates
4. **Important:** Check the "Visibility" toggle — set to visible for packages you're selling

### 6.4 Configure studio settings
1. Click **"Settings"** in the sidebar
2. Review every setting:
   - **Max class capacity** (default: 12)
   - **Late cancellation cutoff** (default: 12 hours)
   - **Booking window** (default: 7 days / 168 hours)
   - **Studio timezone** (default: Asia/Dubai)
   - **Currency** (default: AED)
3. Click **"Save Settings"**

### 6.5 Create your class schedule
1. Click **"Schedule"** in the sidebar
2. Click **"Add Class"** for each class you run
3. Fill in: title, category, instructor, date/time, room, capacity
4. For recurring classes, add each occurrence (we'll add recurring rule automation later)

### 6.6 Set up your instructor
1. Click **"Clients"** → filter by role **Instructor**
2. Edit the sample instructor profile with real name, specializations, payout rate

### 6.7 Add your first real client
1. Click **"Clients"** → **"Add Client"**
2. Fill in their details
3. Click **"Sell Package"** to assign their membership
4. Record their payment

---

## STEP 7 — Daily Operations Guide

### For Reception Staff — Starting the Day
1. Log in at `your-app-url.vercel.app/login`
2. You land on the **Staff Dashboard** showing today's classes
3. For check-in: click **"Check-In"** in the bottom nav
4. Select the current class and check off attending clients

### For Booking a Client
1. Go to **"Clients"** → find the client
2. Click their name
3. Click **"Book Class"**
4. Select the class
5. System automatically checks credits and capacity

### For Recording a Payment
1. Go to **"Clients"** → find the client
2. Click **"Record Payment"**
3. Enter amount, payment method, notes
4. Client's balance updates automatically

### For Clients — Self-Booking
1. They go to: `your-app-url.vercel.app/login`
2. Log in with the email you gave them + the temporary password
3. Click **"Book a Class"**
4. Select date, then class
5. Confirm booking
6. They receive a WhatsApp confirmation (if they've set up CallMeBot)

---

## STEP 8 — Running Reminders (Scheduled Jobs)

To send automatic reminders (expiry warnings, overdue payments), you need to run these periodically.

### Free option: Vercel Cron Jobs
Add to `vercel.json` in your project root:
```json
{
  "crons": [
    {
      "path": "/api/notifications?action=expiry_reminders",
      "schedule": "0 9 * * *"
    },
    {
      "path": "/api/notifications?action=overdue_reminders",
      "schedule": "0 10 * * 1"
    }
  ]
}
```
This runs expiry reminders every day at 9 AM and overdue reminders every Monday.

### Manual option:
Go to **Settings → Notifications** and click **"Run Expiry Reminders"** manually each week.

---

## Troubleshooting

### "I can't log in"
- Check you're using the right email and password
- Make sure you completed Step 5 (database setup)
- Try clicking "Forgot Password" to reset

### "WhatsApp messages aren't sending"
1. Go to Settings → Notifications → click "Test WhatsApp"
2. If it fails, check your `CALLMEBOT_API_KEY` is correct in Vercel
3. Make sure your phone number format is correct (no +, no spaces)

### "The app shows an error page"
- Check your Vercel environment variables are all set correctly
- Look at Vercel dashboard → Functions → Logs for error details

### "Booking isn't working"
- Check the client has an active package with remaining credits
- Check the class isn't full
- Check the booking window hasn't opened yet

### Getting help
- Vercel support: https://vercel.com/support
- Supabase support: https://supabase.com/support

---

## Security Checklist

Before going live:
- [ ] Changed founder password from default
- [ ] Changed staff password from default
- [ ] Changed instructor password from default
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is set in Vercel env (not in code)
- [ ] No sensitive data is hardcoded in any file
- [ ] Vercel project is NOT public
- [ ] You've tested login/logout works

---

## Pricing Notes

All prices in the seed data are in AED (UAE Dirhams). Before going live:
1. Update all package prices to your actual rates
2. Update the `currency` setting in Settings if not using AED
3. Update your wellness product prices

---

*Built for The Movement Studio. For technical issues, contact your developer.*

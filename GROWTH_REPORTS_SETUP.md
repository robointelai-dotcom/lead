# Growth Report Generator — Setup Guide

Your LeadFlow Pro instance now generates a **personalized digital-health & AI-maturity report** for every lead the moment they're saved. This document explains how to enable & operate it in production.

---

## 🎯 What was built

1. **Automatic report generation** — the moment `Save Lead` is clicked on `/search`, a BullMQ job auto-fires:
   - Hybrid audit (Google PageSpeed + HTML sniffing + heuristic scoring)
   - Niche-aware HTML render (dental / restaurant / lawyer / generic)
   - Upload to Supabase Storage (`reports` bucket → public URL)
   - If lead has an email, auto-send via GoHighLevel Conversations API
2. **Public URL** — `https://leadflowtool.com/r/{reportId}` — no auth, mobile-friendly, print-optimized
3. **PDF button** — every report has a "📄 Save as PDF" button that uses the browser's native print-to-PDF (works on all major browsers; produces a clean 3-6 page PDF)
4. **In-app dashboard** — new **Growth Reports** page (sidebar → Analytics) shows every report with pulse score, status (Queued / Generating / Ready / Sent / Failed), views, resend/regenerate actions
5. **Per-lead card** — `/leads/[id]` shows the latest report with pulse score, delivery status, and "Open Report" button

## 📋 New sections in the report (beyond the sample)

- **Website & Lead Capture Health** — contact form presence, form-field count, click-to-call, sticky mobile CTA, live-chat, booking widget
- **AI Overviews & Generative Engine Readiness** — JSON-LD, LocalBusiness schema, FAQPage schema, AI readiness score with actionable findings
- **Close the AI gap in 30 days** CTA band — all 6 Robointech services: AI Calling · AI Appointments · AI-Ready Website · AI Reputation · SEO Backlinks · AISEO / GEO

## ⚙️ Required env vars (Hostinger)

```
# You already have these
DATABASE_URL=postgres://...
DIRECT_URL=postgres://...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=https://leadflowtool.com
ENCRYPTION_SECRET=...
REDIS_URL=redis://localhost:6379
SUPABASE_URL=https://jtgmqjgmcaynehrethhl.supabase.co
SUPABASE_API_KEY=sb_secret_...

# NEW — optional, all have safe defaults
SUPABASE_REPORTS_BUCKET=reports          # storage bucket name
PAGESPEED_API_KEY=                       # optional — improves rate limits
```

## 🗄️ Database migration

The Prisma schema now includes a new `growth_reports` table + `ghlBookingUrl` on `integrations`. Push to Supabase:

```bash
DATABASE_URL="postgresql://postgres.jtgmqjgmcaynehrethhl:PASSWORD@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres" \
  npx prisma db push
```

## 🪣 Supabase Storage bucket

The worker auto-creates the `reports` bucket as **public** on first upload. If you want to create it manually with tighter policies:

1. Supabase Dashboard → Storage → New Bucket
2. Name: `reports`
3. Public bucket: ✅ (public reports are the whole point)
4. File-size limit: 5 MB
5. Allowed MIME types: `text/html`, `application/pdf`

## 📧 GHL email delivery

To send reports as emails, connect **GoHighLevel** in `/integrations`:
- **Access Token** — from your GHL Sub-Account → Settings → API Key or OAuth
- **Refresh Token** — optional
- **Location ID** — from the URL when inside a GHL sub-account (`app.gohighlevel.com/location/{locationId}`)
- **Booking URL** *(NEW field — add via `/api/integrations/save`)* — your calendar link, shown as the "Book Free Strategy Call" button in every report

**Behaviour**:
- Missing GHL creds → report is generated & viewable, but not emailed
- `MOCK_TOKEN` → email is "mock-sent" (logged, not actually delivered — useful for testing)
- Real token → contact is upserted in GHL then the report link is emailed

## 🚀 Deploy on Hostinger

```bash
ssh root@your-vps
cd /var/www/leadflow
git pull                                          # brings all the new files
yarn install                                       # installs @supabase/supabase-js
npx prisma db push                                 # applies the growth_reports table
pm2 reload all                                     # restart web + worker
pm2 logs leadflow-worker --lines 50               # verify report worker booted
```

You should see in the logs:
```
[worker] ✅ search worker running
[worker] ✅ github-dispatch worker running
[worker] ✅ ghl-sync worker running
[worker] ✅ report worker running
[report-worker] ready and listening for jobs
```

## 🧪 Test the flow

1. Log in to your app
2. Go to `/search` → search for "Dentist" in your test city
3. Click **Save Lead** on any result
4. Watch the log stream: `[report-worker] processing report ... → READY → SENT to <email>`
5. Go to `/growth-reports` — you'll see the new report with a pulse score
6. Click **Open** — the full report opens at `https://leadflowtool.com/r/{id}`
7. On the report, click **📄 Save as PDF** — browser prints to PDF with the letterhead/CTA band preserved

## 🧯 Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Report stuck in `PENDING` forever | Report worker isn't running | `pm2 status` — restart `leadflow-worker` |
| Report `FAILED` with "Supabase not configured" | `SUPABASE_URL`/`SUPABASE_API_KEY` missing | Set env vars, restart worker |
| Report `READY` but never `SENT` | GHL creds not connected OR lead has no email | Connect GHL in `/integrations`; ensure lead has an email |
| Pulse score always ~50 | Website unreachable during audit | Check `robots.txt` isn't blocking `LeadFlowPro/1.0` UA |
| PDF button produces blank page | Browser print dialog cancelled | Retry — every browser handles print-to-PDF slightly differently |

## 🛣️ What's next (backlog)

- **Regenerate with fresh data** — currently uses cached PageSpeed results if within 24h
- **Server-side PDF generation** via headless Chromium (currently browser-side print-to-PDF)
- **A/B email subject lines** — track open rates per subject variant
- **Per-niche templates** — add restaurant / lawyer / salon specific KPIs beyond the currently niche-aware terminology
- **Report analytics** — heatmap of which sections get scrolled longest

Enjoy the closed loop — every lead now gets a beautiful, personalized audit within seconds of being saved. 🎉

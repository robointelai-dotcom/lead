# LeadFlow Pro — Complete Feature Guide & Documentation

> AI-powered B2B lead generation, qualification and CRM-sync platform.
> Built as a multi-tenant Next.js 16 SaaS with PostgreSQL, Redis, BullMQ, Prisma 7.

---

## Table of contents

1. [What LeadFlow Pro does](#1-what-leadflow-pro-does)
2. [Login & first steps](#2-login--first-steps)
3. [Dashboard](#3-dashboard)
4. [Campaigns](#4-campaigns)
5. [Search Leads (Google Places + AI email discovery)](#5-search-leads)
6. [Saved Leads & Lead profile](#6-saved-leads--lead-profile)
7. [Email Campaigns & Templates](#7-email-campaigns--templates)
8. [Reports](#8-reports)
9. [Team](#9-team)
10. [Subscription & Usage](#10-subscription--usage)
11. [Settings](#11-settings)
12. [Integrations (GitHub / GHL / Callfluent / AI providers)](#12-integrations)
13. [Automation pipelines under the hood](#13-automation-pipelines-under-the-hood)
14. [API reference (webhooks & routes)](#14-api-reference)
15. [End-to-end workflows (scenarios)](#15-end-to-end-workflows-scenarios)
16. [Environment variables](#16-environment-variables)
17. [Deployment to Emergent (production)](#17-deployment-to-emergent-production)
18. [Local development](#18-local-development)

---

## 1. What LeadFlow Pro does

LeadFlow Pro finds, qualifies and pushes B2B leads through a full outreach → CRM pipeline **without a single manual click after the initial search**. The system is composed of five value stages:

| Stage | Powered by | Output |
|---|---|---|
| 🔎 **Discover** | Google Places API + city-sweep query strategy | Up to 500 businesses per search, deduped by phone/domain/name |
| 📧 **Enrich** | 4-stage email cascade (Google Maps → DB cache → Web Scraper → Gemini 2.5 Flash → OpenAI GPT-4o-mini) | Verified email addresses for leads that don't publish them |
| 🤖 **Automate** | GitHub `repository_dispatch` fan-out to `Workflow-Automation-` repo | Kicks off any workflow you like — SMS drips, LinkedIn outreach, custom node.js orchestrator |
| 📞 **Qualify** | Callfluent AI voice calls with post-call webhook ingestion | Automatic lead-status transitions based on call intent |
| 💼 **Convert** | GoHighLevel CRM contact upsert | Every QUALIFIED lead lands in your GHL sub-account with tags & source |

Everything is multi-tenant: every DB query is filtered by `organizationId`, and every integration secret is stored per-org, encrypted at rest with AES-256-GCM.

---

## 2. Login & first steps

- **Login URL** (preview): `http://localhost:3000/login`
- **Demo credentials**:
  - `admin@acme.com` / `password123` (OWNER of "Acme Lead Agency")
  - `sarah@acme.com` / `password123` (MANAGER)
  - `mike@acme.com` / `password123` (AGENT)

### Creating a new organization
1. Go to `/register`
2. Fill in name / email / password / organization name
3. You're auto-signed-in as `OWNER` and taken to `/dashboard`
4. A `FREE` subscription plan is auto-provisioned (100 searches, 500 emails, 3 campaigns, 2 team members / month)

### Roles & permissions

| Permission | OWNER | ADMIN | MANAGER | AGENT | VIEWER |
|---|:-:|:-:|:-:|:-:|:-:|
| Manage Organization | ✓ | ✓ | | | |
| Manage Team | ✓ | ✓ | | | |
| Manage Campaigns | ✓ | ✓ | ✓ | | |
| Search Leads | ✓ | ✓ | ✓ | ✓ | |
| Manage Leads | ✓ | ✓ | ✓ | ✓ | |
| Send Emails | ✓ | ✓ | ✓ | ✓ | |
| View Reports | ✓ | ✓ | ✓ | ✓ | ✓ |
| Export Data | ✓ | ✓ | ✓ | | |

---

## 3. Dashboard `/dashboard`

The main landing page after login. Shows:

- **KPI cards**: total campaigns, active campaigns, total leads, new leads this month, leads with email, leads with phone, qualified, won, emails sent, avg open rate, conversion rate
- **Search quota progress**: e.g. `42/1000 searches used this month`
- **Lead growth chart**: 6-month trailing new-lead count (Recharts bar chart)
- **Recent campaigns** (top 5): status, niche, lead count, assigned user
- **Recent leads** (top 8): business name, category, city, contact info, current status, source campaign, quality score bar

All data is org-scoped and computed live from Postgres.

---

## 4. Campaigns `/campaigns`

Campaigns are the top-level container that groups leads, email outreach and reporting around a specific goal (e.g. "NYC Restaurants Q3").

### Campaign list `/campaigns`
- Card grid, one card per campaign
- Filter chips: Total / Active / Paused / Draft counts
- Each card shows: name · niche · city/state · status badge · lead count · assigned user · tags · dates
- **Create Campaign** button top-right

### Create campaign `/campaigns/new`
Form fields:
- Name (required)
- Description
- Niche (e.g. Restaurant, Dentist, Plumber)
- Country / State / City
- Goal
- Assign to team member
- Start & end date
- Status: DRAFT → ACTIVE → PAUSED → COMPLETED → ARCHIVED

### Campaign detail `/campaigns/[id]`
- Workspace view with lead table, notes, status history, email campaign links

---

## 5. Search Leads
`/search`

This is the heart of the acquisition engine.

### Search form
- **Niche**: dropdown of 18 pre-seeded niches (Restaurant, Dentist, Plumber, Hair Salon, Gym, Lawyer, Auto Repair, Real Estate, Bakery, Coffee Shop, Electrician, HVAC, Chiropractor, Accountant, Insurance, Marketing Agency, Web Design, Photography). "Any niche" also allowed.
- **Country**: United States / Canada / United Kingdom / Australia
- **State / Province**
- **City**
- **Max results**: 20 / 60 / 100 / 500 leads

### How the search works internally

1. **Provider selection** — if the org has an active `google-places` integration, `GooglePlacesProvider` is used; otherwise `MockLeadProvider` returns synthetic data for demo.
2. **City-sweep strategy** — for requests above 60 results, the system fires up to 14 geographic query variants (`{niche} in {location}`, `{niche} near {location}`, `best {niche}`, `top rated {niche}`, `{niche} north/south/east/west {city}`, `{niche} downtown {city}`, etc.) to break past Google's 60-result cap.
3. **Concurrent detail hydration** — up to 10 parallel `Place Details` API calls to enrich each result with phone/website/rating.
4. **Multi-key dedup** — same place_id, phone, domain OR name+address all collapse to a single lead.
5. **Post-filters** — `minRating`, `minReviewCount`, `hasEmail`, `hasPhone`, `hasWebsite` filters applied client-side.
6. **Usage increment** — `UsageRecord.searchesUsed +=1` for the current month, org-scoped.

### 4-stage AI email discovery cascade
Every result that doesn't already have an email is auto-processed in batches of 5 immediately after the results load:

1. **Google Map** — email exposed directly in the Places API result
2. **DB cache** — check if we already have this lead's email saved (matched by `sourceId`, `normalizedDomain`, or `normalizedPhone`)
3. **Web Scraper** — fetch the homepage + up to 5 `/contact`, `/contact-us`, `/about`, `/about-us`, `/support` sub-pages; prioritise `mailto:` links, dedupe against role-based patterns (`info@`, `contact@`, `hello@`, …)
4. **⚡ Power AI (Gemini 2.5 Flash + Google Search grounding)** — asks Gemini to find the verified public email using its Google-Search tool
5. **🔥 Critical AI (OpenAI GPT-4o-mini)** — final fallback if Gemini blank

Each result renders a color-coded source badge next to the email:
- 🟢 `Google Map`
- ⚪ `Saved` (DB cache)
- 🔵 `Web Scrape`
- 🟣 ⚡ `Power AI`
- 🟠 🔥 `Critical AI`

### Saving a lead
Pick a campaign from the dropdown, hit **Save Lead** on any row. The lead is deduped against your existing org data, quality-scored, and attached to the campaign as a `CampaignLead` with status = `NEW`.

### Async background search (v2)
A new async pipeline is now live behind the UI. Call:

```ts
import { enqueueSearchJobAction } from "@/app/(dashboard)/search/actions";

const { success, searchJobId } = await enqueueSearchJobAction({
  niche: "Dentist",
  country: "US",
  state: "CA",
  city: "Los Angeles",
  maxResults: 500,
  campaignId: "cmp_xxx",        // auto-attach discovered leads
  autoFindEmails: true,          // run the 4-stage cascade for each
  autoDispatchToGithub: true,    // fan-out finished leads to Workflow-Automation-
});
```

Poll status with `getSearchJobStatusAction(searchJobId)` — you'll see the row transition **PENDING → PROCESSING → COMPLETED / FAILED** with live counters for `totalProcessed`, `totalFound`, `totalWithEmail`, `totalWithPhone`.

---

## 6. Saved Leads & Lead profile

### `/leads`
Table of all saved leads for your org:
- Business · Contact (email + phone) · Location · Rating · Quality score bar (0–100) · Campaign · Status badge · Added date
- Free-text search across business name / email / city
- Quick stats: total · with email · with phone
- **Export CSV** button (route is scaffolded — see backlog)

### `/leads/[id]` — Lead profile
- Business info, contact info, location map coordinates, description
- Quality score, verified / claimed / open badges
- **Campaign memberships sidebar** — each campaign the lead is in, with an inline status dropdown

### Inline status picker (drives GHL sync)
The dropdown on each `Campaign Memberships` row lets you move the lead through the pipeline:

```
NEW → CONTACTED → REPLIED → QUALIFIED → PROPOSAL_SENT → WON / LOST / DO_NOT_CONTACT
```

- Change is persisted transactionally along with a `LeadStatusHistory` row
- **When you set the status to `QUALIFIED`**, a GHL contact upsert is auto-enqueued. You'll see a banner:
  > ✓ Updated · GHL contact upsert enqueued

---

## 7. Email Campaigns & Templates

### `/email-templates`
- Grid of reusable HTML templates
- Each template supports personalization variables:
  `{{business_name}}`, `{{contact_name}}`, `{{city}}`, `{{state}}`, `{{country}}`, `{{category}}`, `{{website}}`, `{{phone}}`, `{{sender_name}}`, `{{company_name}}`
- **3 templates seeded**: Initial Outreach · Follow Up · Value Proposition

### `/email-campaigns`
- List of email campaigns with per-campaign stats (queued / sent / opened / clicked / replied / bounced / unsubscribed)
- Status: DRAFT → SCHEDULED → SENDING → PAUSED → COMPLETED
- `New Email Campaign` → `/email-campaigns/new` (compose form)

> **Note**: Real email sending currently uses `MockEmailProvider` (logs to console). Wire up SendGrid / Resend / Mailgun in `src/lib/email-provider.ts` — the `EmailProvider` interface is already there.

---

## 8. Reports `/reports`

- List of saved reports (last 10)
- Campaign-performance bar chart (leads per campaign, top 8)
- Filter by campaign / date range / metric
- **New Report** generation is scaffolded but not yet persisted (backlog)

---

## 9. Team `/team`

- Member roster with role badge, status, join date
- Invite button (UI-only for now)
- Role-permission matrix at the bottom (see [Roles & permissions](#roles--permissions))

---

## 10. Subscription & Usage `/subscription`

- Current plan card with live usage progress bars for searches / emails / campaigns / team members
- 4-plan comparison grid:

| Plan | Price | Searches | Emails | Campaigns | Team |
|---|---|---:|---:|---:|---:|
| **Free** | $0 | 100 | 500 | 3 | 2 |
| **Starter** | $49 | 500 | 2,500 | 10 | 5 |
| **Professional** | $99 | 2,000 | 10,000 | 50 | 15 |
| **Enterprise** | Custom | ∞ | ∞ | ∞ | ∞ |

> **Note**: Stripe billing is not wired in yet (UI-only).

---

## 11. Settings `/settings`

- **Profile**: name, email
- **Organization**: name, slug, website, industry, timezone

---

## 12. Integrations

`/integrations` — the control-plane for all third-party connections. Every secret is encrypted with AES-256-GCM before hitting the DB.

### Available integrations

| Category | Provider | Purpose |
|---|---|---|
| **Lead Providers** | Google Places API | Real Google Maps business data (backs `/search`) |
| | Google Gemini AI ⚡ | Power-AI email discovery (2.5 Flash + Google Search grounding) |
| | OpenAI GPT 🔥 | Critical-AI email discovery fallback (GPT-4o-mini) |
| **Email Providers** | Mock (built-in) | Dev logging |
| **Automation Bridges** | GitHub Automation | `repository_dispatch` fan-out to `Workflow-Automation-` |
| **CRM Connectors** | GoHighLevel CRM | Contact upsert on QUALIFIED lead |
| **Voice AI** | Callfluent AI | Post-call webhook ingestion (auto lead qualification) |

### Connect a provider

Click **Connect** on any card. A modal opens with the correct form:

- **Simple API key** (Google Places, Gemini, OpenAI): single password-masked field
- **GitHub**: PAT + repo owner (default `robointelai-dotcom`) + repo name (default `Workflow-Automation-`) + target branch (default `main`)
  > 💡 Use the sentinel `MOCK_TOKEN` to smoke-test without firing real HTTPS calls
- **GoHighLevel**: access token + refresh token + location ID
  > 💡 Use `MOCK_TOKEN` as the access token — the upsert will log a mock success without hitting GHL
- **Callfluent**: single API key

Behind the scenes the form POSTs to `/api/integrations/save`, which:
1. Encrypts every secret with `encryptToken()` (AES-256-GCM keyed on `ENCRYPTION_SECRET`)
2. Upserts by `(organizationId, provider)` (multi-tenant safe)
3. Revalidates `/integrations`

### Disconnect
Hit **Disconnect** on a connected card. The row's `isActive` flag flips to `false`. Credentials are retained (encrypted) so re-enabling is instant.

---

## 13. Automation pipelines under the hood

Three background workers (all BullMQ + Redis) power the async magic:

### 🔎 `leadflow-search` — Search Worker
- **Trigger**: `enqueueSearchJobAction()`
- **What it does**:
  1. Transitions `SearchJob` → `PROCESSING`
  2. Calls the org's lead provider (Google Places or Mock) with the city-sweep sweep
  3. Runs the 4-stage email cascade for each result (concurrent-safe)
  4. Deduplicates + persists each lead + records a `SearchResult` row
  5. Auto-attaches leads to a campaign if `campaignId` was provided
  6. Increments the org's `UsageRecord.searchesUsed`
  7. Optionally fans-out to GitHub (see below)
  8. Transitions `SearchJob` → `COMPLETED` (or `FAILED`)

### 🐙 `leadflow-github-dispatch` — GitHub Dispatcher
- **Trigger**: search worker fires this after a successful search when `autoDispatchToGithub=true`, OR manually via `dispatchGithubRepositoryEvent()`
- **What it does**: POSTs to `https://api.github.com/repos/{owner}/{repo}/dispatches`

```json
{
  "event_type": "leadflow_outreach_trigger",
  "client_payload": {
    "organizationId": "cmp_xxx",
    "searchJobId":    "job_yyy",
    "dispatchedAt":   "2026-07-14T20:00:00Z",
    "branch":         "main",
    "count":          5,
    "data": [
      { "id": "l1", "businessName": "…", "email": "…", "phone": "…", "website": "…", "address": "…", "city": "…", "state": "…", "country": "…", "category": "…", "rating": 4.5, "reviewCount": 210 }
    ]
  }
}
```

- **MOCK MODE**: fires when the GitHub PAT is missing / equals `MOCK_TOKEN`. Logs `[github-dispatcher][MOCK] Would dispatch N leads to <owner>/<repo>` and returns a fake 204.
- **Retry**: 3 attempts with exponential backoff.

### 📞💼 `leadflow-ghl-sync` — GHL Contact Syncer
- **Trigger**: Callfluent webhook OR manual status change — whenever a `campaign_lead` transitions to `QUALIFIED`
- **What it does**: POSTs to `https://services.leadconnectorhq.com/contacts/upsert` (v2 API, `Version: 2021-07-28`)

Payload shape:
```json
{
  "locationId":  "lctn_abc",
  "firstName":   "Manhattan",
  "lastName":    "Steakhouse",
  "name":        "Manhattan Steakhouse",
  "companyName": "Manhattan Steakhouse",
  "email":       "info@manhattansteak.com",
  "phone":       "+1 (212) 555-0102",
  "website":     "https://manhattansteak.com",
  "address1":    "…",
  "city": "New York",
  "state": "NY",
  "country": "US",
  "postalCode": "10001",
  "source":  "LeadFlow Pro",
  "tags":    ["leadflow-pro", "category:restaurant", "status:qualified"]
}
```

- **Idempotent** — jobId = `ghl-sync-{leadId}-{reason}`, so the same lead never double-syncs for the same event
- **MOCK MODE**: fires when the GHL access token is missing / equals `MOCK_TOKEN`. Logs `[ghl-syncer][MOCK] Would upsert contact "X" into GHL location Y` and returns a fake 200.
- **Retry**: 5 attempts with exponential backoff.

### Where the workers run
- **In-process** — `src/instrumentation.ts` boots them inside the Next.js server automatically (non-fatal if Redis is down)
- **Standalone** — `scripts/worker.ts` runs them in a dedicated Node process (recommended for production, started by supervisor)

Opt out with `LEADFLOW_AUTOSTART_WORKERS=false` in the env.

---

## 14. API reference

### `POST /api/webhooks/callfluent` — Callfluent post-call ingestion

Accepts a JSON body with the shape:

```json
{
  "organization_id": "cmp_xxx",         // OR leadId to resolve org
  "lead_id":         "lead_yyy",         // optional
  "call_id":         "cf_call_123",
  "phone":           "+1 (212) 555-0101",
  "direction":       "outbound",
  "status":          "completed",
  "duration":        210,
  "recording_url":   "https://…",
  "transcript":      "Yes, please book us a demo…",
  "sentiment":       "positive",
  "intent":          "interested",
  "occurred_at":     "2026-07-14T19:00:00Z"
}
```

**Intent → status mapping**:

| Intent (any of) | New status |
|---|---|
| `interested`, `booked`, `qualified` | `QUALIFIED` |
| `callback`, `callback_requested` | `REPLIED` |
| `not_interested`, `declined` | `LOST` |
| `do_not_contact`, `dnc` | `DO_NOT_CONTACT` |
| `voicemail`, `no_answer` | `CONTACTED` |

**Lead resolution**: `leadId` (direct) → else `organization_id + normalizedPhone` match → else the payload is rejected with `success: false`.

**Response**:
```json
{
  "success": true,
  "callLogId": "cl_zzz",
  "leadId": "lead_yyy",
  "intent": "interested",
  "updatedCampaignLeads": 1,
  "ghlSyncEnqueued": true
}
```

**Signature verification**: currently a no-op — marked with a `// TODO` at the top of the route file. Add HMAC verification here once Callfluent shares the signing secret.

### `POST /api/integrations/save` — Integrations control-plane

Auth: requires an active session cookie (`leadflow_session`). Accepts:

```json
{
  "provider": "github" | "ghl" | "callfluent" | "gemini" | "openai" | "google-places" | "sendgrid" | ...,
  "name":     "GitHub Automation",
  "isActive": true,
  "apiKey":   "<encrypted-at-rest>",

  "githubToken":        "…",
  "githubRepoOwner":    "robointelai-dotcom",
  "githubRepoName":     "Workflow-Automation-",
  "githubTargetBranch": "main",

  "ghlAccessToken":  "…",
  "ghlRefreshToken": "…",
  "ghlLocationId":   "lctn_abc",

  "callfluentApiKey": "…"
}
```

All secret fields are AES-256-GCM-encrypted before being written. Upsert key is `(organizationId, provider)`.

### `GET` health probes

- `GET /api/webhooks/callfluent` → `{"ok":true,"service":"callfluent-webhook",…}`
- `GET /api/integrations/save`  → `{"ok":true,"service":"integrations-save","method":"POST"}`

---

## 15. End-to-end workflows (scenarios)

### Scenario A — First mining run
1. Log in as `admin@acme.com` / `password123`
2. `/integrations` → connect **Google Places** (real API key) + **Gemini AI** (real API key) + **OpenAI** (real API key)
3. `/campaigns/new` → create "LA Dentists Q3"
4. `/search` → niche=Dentist, city=Los Angeles, maxResults=100 → **Search Places**
5. Wait ~15s — results stream in with color-coded email badges (⚡ Power AI dominates)
6. Select "LA Dentists Q3" from the "Save to Campaign" dropdown
7. Click **Save Lead** on the ones you want

### Scenario B — Fully automated Callfluent → GHL loop
1. `/integrations` → connect **Callfluent** (drop your API key) + **GoHighLevel CRM** (access token + location ID)
2. Configure your Callfluent voice campaign to POST call-completion events to `https://your-app.example.com/api/webhooks/callfluent` with your `organization_id` embedded
3. When Callfluent AI detects "interested", the webhook fires:
   - `CallLog` persisted with duration/transcript/sentiment/intent
   - The matching lead's `campaign_lead.status` → `QUALIFIED`
   - `LeadStatusHistory` records the transition
   - GHL sync job enqueued
   - GHL worker calls `POST services.leadconnectorhq.com/contacts/upsert`
   - Contact appears in your GHL sub-account tagged `leadflow-pro`, `category:dentist`, `status:qualified`
4. Your existing GHL automations (SMS drip, task assignment, etc.) fire on the new contact

### Scenario C — GitHub-automation fan-out
1. `/integrations` → connect **GitHub Automation** (paste a fine-grained PAT with `repo` scope)
2. Trigger a search via the async pipeline with `autoDispatchToGithub: true`
3. On completion, the GitHub dispatcher POSTs `repository_dispatch` at `robointelai-dotcom/Workflow-Automation-`
4. The workflow `.github/workflows/outreach.yml` (installed manually) picks it up, exposes `LEADFLOW_ORG_ID`, `LEADFLOW_JOB_ID`, `LEADFLOW_COUNT` env vars, and runs `node src/orchestrator.js` with the lead payload in `.leadflow/payload.json`

### Scenario D — Manual promotion → GHL
1. `/leads/[id]` → find a lead in `CONTACTED` state
2. Use the inline status dropdown to move it to `QUALIFIED`
3. See the banner: **✓ Updated · GHL contact upsert enqueued**
4. Within ~2s the contact lands in GHL with the appropriate tags

---

## 16. Environment variables

| Variable | Required | Default (dev) | Notes |
|---|:-:|---|---|
| `DATABASE_URL` | ✅ | `postgresql://leadflow:leadflowpass@localhost:5432/leadflow_db` | Postgres URI |
| `NEXTAUTH_SECRET` | ✅ | dev fallback | Session JWT signing (≥32 chars) |
| `NEXTAUTH_URL` | ✅ | `http://localhost:3000` | Public app URL |
| `ENCRYPTION_SECRET` | ✅ | fallback | AES-256-GCM key derivation |
| `REDIS_URL` | ✅ | `redis://localhost:6379` | BullMQ backing store |
| `EMAIL_PROVIDER` | | `mock` | `mock` / `sendgrid` / `resend` / `mailgun` |
| `LEAD_PROVIDER` | | `mock` | Reserved — currently detected via `/integrations` |
| `GITHUB_TOKEN` | | `MOCK_TOKEN` | Optional fallback for GitHub dispatch (also stored per-org via UI) |
| `LEADFLOW_AUTOSTART_WORKERS` | | `true` | Set to `false` to skip in-process worker boot |
| `DEBUG_GOOGLE_PLACES` | | | Set `1` for verbose Places API logs |

---

## 17. Deployment to Emergent (production)

Emergent's managed infra provides MongoDB Atlas. This app runs on Postgres + Redis, so you'll bring your own hosted services and inject them via production secrets.

### One-time setup
1. Provision a **Neon** (or Supabase / AWS RDS) Postgres — copy the connection string
2. Provision an **Upstash** (or Redis Cloud) Redis — copy the connection URL
3. Push the Prisma schema to the new Postgres:
   ```
   DATABASE_URL="postgresql://…neon…" npx prisma db push
   DATABASE_URL="postgresql://…neon…" npx prisma db seed   # optional demo data
   ```

### Emergent deploy console secrets
Set these (they'll override the placeholder values in `backend/.env`):

| Secret | Value |
|---|---|
| `DATABASE_URL` | Your Neon URL |
| `REDIS_URL` | Your Upstash URL |
| `NEXTAUTH_SECRET` | 32+ char random string (e.g. `openssl rand -hex 32`) |
| `ENCRYPTION_SECRET` | 32+ char random string |
| `NEXTAUTH_URL` | Your production URL (e.g. `https://ai-leads-8.preview.emergentagent.com`) |
| `GITHUB_TOKEN` | Optional — leave `MOCK_TOKEN` if you'll manage per-org PATs via the UI |

Hit **Deploy** — the container will `npm install` (triggering `postinstall: prisma generate`), run `next build`, and start with `next start`.

### `.github/workflows/outreach.yml`
Copy the file at `/app/.github/workflows/outreach.yml` into your **companion repo** `robointelai-dotcom/Workflow-Automation-`. That's how the downstream orchestrator receives dispatched leads.

---

## 18. Local development

```bash
# 1. Prereqs (once)
apt-get install -y postgresql postgresql-contrib redis-server
pg_ctlcluster 15 main start
redis-server --daemonize yes --port 6379

# 2. Create DB + user
sudo -u postgres psql -c "CREATE USER leadflow WITH PASSWORD 'leadflowpass' SUPERUSER;"
sudo -u postgres psql -c "CREATE DATABASE leadflow_db OWNER leadflow;"

# 3. Push schema + seed
npx prisma db push
npm run seed

# 4. Dev server + worker (two terminals, or via supervisor)
npm run dev            # http://localhost:3000
npm run worker         # standalone BullMQ worker (optional — instrumentation also boots it in-process)
```

### Useful scripts
- `npm run dev` — Next.js dev server (Turbopack) with hot reload
- `npm run build` — `prisma generate && next build`
- `npm run start` — production Next.js server
- `npm run seed` — populate demo org / users / campaigns / leads
- `npm run worker` — standalone BullMQ worker (search + github-dispatch + ghl-sync)
- `npm run lint` — ESLint
- `npx tsc --noEmit` — TypeScript check
- `npx tsx scripts/smoke.ts` — crypto + GitHub dispatcher smoke test
- `npx tsx scripts/smoke-search.ts` — full search → save → dispatch smoke
- `npx tsx scripts/smoke-ghl.ts` — GHL sync smoke test

---

## Architecture at a glance

```
┌──────────────┐   ┌────────────────────────────┐   ┌───────────────────┐
│  Next.js 16  │──▶│  Postgres 15 (Prisma 7)    │◀──│  Search Worker    │
│  App Router  │   │  21 models · multi-tenant  │   │  (BullMQ)         │
└──────┬───────┘   └────────────────────────────┘   └────────┬──────────┘
       │                                                     │
       ▼                                                     ▼
┌─────────────────┐   ┌──────────────────────┐   ┌────────────────────┐
│  Redis 7        │◀──│  GitHub Dispatcher   │──▶│  robointelai-      │
│  BullMQ queues  │   │  (repository_        │   │  dotcom/Workflow-  │
└─────────────────┘   │  dispatch)           │   │  Automation-       │
                      └──────────────────────┘   └────────────────────┘
       ▲
       │
┌──────┴──────────┐   ┌──────────────────────┐   ┌────────────────────┐
│  Callfluent AI  │──▶│  /api/webhooks/     │──▶│  GHL Syncer        │
│  voice nodes    │   │  callfluent          │   │  → contacts/upsert │
└─────────────────┘   └──────────────────────┘   └────────────────────┘
                                                          │
                                                          ▼
                                                 ┌────────────────────┐
                                                 │  GoHighLevel CRM   │
                                                 │  (per-tenant loc.) │
                                                 └────────────────────┘
```

---

**Version**: 1.0.0 · Jan 2026
**Login**: `admin@acme.com` / `password123`
**Preview URL**: http://localhost:3000

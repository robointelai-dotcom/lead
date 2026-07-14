# LeadFlow Pro — Product Requirements Document

## Original Problem Statement
> "We build the AI Lead generation system. Can you analyse the code and check what all it is doing so that we can see what all needs to be done."
>
> Follow-up (2026-07-14): Implement the definitive production-grade architecture with GitHub Automation repo bridge (`robointelai-dotcom/Workflow-Automation-`), Callfluent AI voice nodes, and GoHighLevel CRM. 7 phases delivered.

## Architecture

- **Framework**: Next.js 16.2 (App Router) + React 19 + TypeScript strict
- **Database**: PostgreSQL 15 + Prisma 7 (pg adapter) — 21 models
- **Auth**: Custom JWT sessions (bcryptjs + jsonwebtoken), 7-day httpOnly cookies
- **Queue**: BullMQ + Redis 7 for async lead-mining and GitHub dispatch fan-out
- **Crypto**: AES-256-GCM for all integration secrets at rest (`src/lib/crypto.ts`)
- **Multi-tenant**: Every DB write is explicitly scoped by `organizationId`
- **AI**: Gemini 2.5 Flash (Google-Search grounding) + OpenAI GPT-4o-mini fallback for email discovery

## User Personas

- **Owner / Admin** — configures integrations, manages team, billing
- **Manager** — creates campaigns, assigns leads, monitors reports
- **Agent** — searches leads, saves them into campaigns, works the pipeline
- **Viewer** — read-only on dashboards / reports

## Core Requirements (Static)

1. Multi-tenant SaaS with role-based access (OWNER / ADMIN / MANAGER / AGENT / VIEWER)
2. Async lead-mining from Google Places with city-sweep query strategy (up to 500/query)
3. 4-stage AI email-discovery cascade (Google Map → DB cache → Web Scrape → Gemini → OpenAI)
4. GitHub `repository_dispatch` fan-out to companion `Workflow-Automation-` repo
5. Callfluent AI voice-node webhook ingestion → auto-update lead status
6. GHL CRM token vault (access / refresh / location)
7. Encrypted-at-rest storage for every third-party secret

## What's Been Implemented (2026-07-14)

### Phase 1 — Prisma Modernization  ✅
- Added GitHub fields to `Integration`: `githubToken`, `githubRepoOwner` (default `robointelai-dotcom`), `githubRepoName` (default `Workflow-Automation-`), `githubTargetBranch` (default `main`)
- Added GHL fields: `ghlAccessToken`, `ghlRefreshToken`, `ghlLocationId`
- Added Callfluent field: `callfluentApiKey`
- Added `PROCESSING` state to `SearchJobStatus`
- New `CallLog` model with duration / recordingUrl / transcript / sentiment / intent, plus rawPayload JSON snapshot, indexed by `organizationId` + `leadId`
- `npx prisma db push` applied cleanly

### Phase 2 — Token Cryptography  ✅
- `src/lib/crypto.ts` — AES-256-GCM with SHA-256 derived 32-byte key
- Format: `base64(iv):base64(authTag):base64(cipher)`
- `encryptToken(text)` / `decryptToken(cipher)` / `isEncrypted(v)`
- Uses `process.env.ENCRYPTION_SECRET` with hard-coded local fallback

### Phase 3 — Async Search Queues  ✅
- `src/lib/queue.ts` — shared BullMQ setup with two queues (`leadflow-search`, `leadflow-github-dispatch`)
- `src/lib/workers/searchWorker.ts` — consumes search jobs, transitions PENDING → PROCESSING → COMPLETED/FAILED, runs city-sweep + 4-stage cascade, updates progress every 10 items, org-scoped
- `enqueueSearchJobAction()` / `getSearchJobStatusAction()` / `getSearchJobResultsAction()` server actions added to `src/app/(dashboard)/search/actions.ts`

### Phase 4 — GitHub Dispatcher  ✅
- `src/lib/workers/githubDispatcher.ts`
- POSTs to `https://api.github.com/repos/{owner}/{repo}/dispatches` with `event_type: leadflow_outreach_trigger`
- Payload shape: `{organizationId, searchJobId, dispatchedAt, branch, data: leads[], count}`
- **MOCK MODE**: When `GITHUB_TOKEN` is missing or equal to `MOCK_TOKEN`, no HTTP call is made — a fake 204 success is returned and logged. Verified.
- Own BullMQ worker so failures retry with exponential backoff

### Phase 5 — Workflow Repo Bridge  ✅
- `/.github/workflows/outreach.yml` generated at project root for **manual copy** into `robointelai-dotcom/Workflow-Automation-`
- Listens for `repository_dispatch` type `leadflow_outreach_trigger`
- Writes payload to `.leadflow/payload.json`, exports env vars (`LEADFLOW_ORG_ID`, `LEADFLOW_JOB_ID`, `LEADFLOW_COUNT`, `LEADFLOW_BRANCH`, `LEADFLOW_PAYLOAD_FILE`), then runs `node src/orchestrator.js`

### Phase 6 — Callfluent Webhook  ✅
- `src/app/api/webhooks/callfluent/route.ts`
- Signature verification stubbed with `// TODO` block comment (as requested)
- Extracts duration / transcript / recordingUrl / status / intent / sentiment
- Resolves lead via (a) `leadId`, (b) `organizationId + normalizedPhone`
- Creates `CallLog` (org-scoped)
- Maps intent → LeadStatus (`interested`→QUALIFIED, `callback`→REPLIED, `not_interested`→LOST, `dnc`→DO_NOT_CONTACT, `voicemail`→CONTACTED) and updates all matching `campaign_leads` transactionally, writing `LeadStatusHistory`
- Verified: intent=interested on seeded lead → campaignLead transitioned to QUALIFIED

### Phase 7 — Integrations Control Views  ✅
- `src/app/api/integrations/save/route.ts` — accepts rich JSON body, encrypts every secret via `encryptToken`, upserts by `(organizationId, provider)`, revalidates `/integrations`
- Rebuilt `IntegrationsClient.tsx` with 5 categories (Lead Providers / Email Providers / Automation Bridges / CRM / Voice AI) and 4 form kinds (`api-key`, `github`, `ghl`, `callfluent`)
- Full `data-testid` coverage on cards, form fields, submit button
- Existing `saveIntegrationAction` also updated to encrypt the generic `apiKey` blob
- `getLeadProvider` + `findEmailAction` + `searchWorker` now decrypt tokens on read (backwards-compatible: legacy plaintext values still work via `isEncrypted` sniff)

### Phase 8 — GHL Contact Sync (added post-Phase 7)  ✅
- New BullMQ queue: `leadflow-ghl-sync` (5 attempts, exponential backoff)
- `src/lib/workers/ghlSyncer.ts`:
  - `syncLeadToGhl(orgId, leadId, campaignLeadId?)` — POSTs to `POST https://services.leadconnectorhq.com/contacts/upsert` with `Version: 2021-07-28` header and Bearer auth
  - Payload includes firstName/lastName/companyName/email/phone/website/address/city/state/country/postalCode + auto-tags (`leadflow-pro`, `category:*`, `status:*`)
  - **MOCK MODE**: when `ghlAccessToken` missing or decrypts to `MOCK_TOKEN`, returns `{success:true, mocked:true, contactId:"mock-…"}` with a clear log line — no live HTTP call
  - `enqueueGhlSync()` — idempotent per `(leadId, reason)` jobId so a lead is never double-synced for the same event
  - `startGhlSyncWorker()` — 3-concurrency BullMQ worker
- **Auto-triggered from**:
  1. Callfluent webhook — whenever `intent → QUALIFIED` transition happens, GHL sync is enqueued (`reason: callfluent-qualified`)
  2. Manual status change via new server action `updateCampaignLeadStatusAction()` in `src/app/(dashboard)/leads/actions.ts` (`reason: manual-status-change`)
- New UI: `LeadStatusPicker.tsx` client component on `/leads/[id]` — dropdown for changing lead status, shows real-time banner when GHL sync is enqueued
- Instrumentation + standalone worker script updated to boot the new worker
- Verified end-to-end:
  - Direct call: `syncLeadToGhl()` → `{success:true, mocked:true, contactId:"mock-…"}`
  - Callfluent POST → status → QUALIFIED → `ghlSyncEnqueued:true` in response → worker processes → `[ghl-syncer][MOCK] Would upsert contact "Manhattan Steakhouse" into GHL location lctn_demo_12345`

### Verified End-to-End
- Zero TypeScript errors (`npx tsc --noEmit`)
- `npx next build` — 22 routes compiled cleanly, prod bundle ready
- Search enqueue → worker → COMPLETED in <2s with 5 leads mined, `SearchResult` rows persisted, GitHub dispatch job enqueued and mock-dispatched
- Callfluent POST → CallLog created → CampaignLead status transitioned to QUALIFIED
- Crypto round-trip verified

### Environment
```
DATABASE_URL=postgresql://leadflow:leadflowpass@localhost:5432/leadflow_db?schema=public
NEXTAUTH_SECRET=… (32+ chars)
NEXTAUTH_URL=http://localhost:3000
ENCRYPTION_SECRET=leadflow-pro-aes-256-gcm-encryption-secret-key-abc
REDIS_URL=redis://localhost:6379
GITHUB_TOKEN=MOCK_TOKEN            # replace via Integrations UI in production
EMAIL_PROVIDER=mock
LEAD_PROVIDER=mock
```

### Supervisor Services
- `leadflow-frontend` — Next.js dev on :3000 (also boots in-process workers via instrumentation)
- `worker` — standalone tsx runner for `scripts/worker.ts` (search + github dispatch)
- `leadflow-postgres` / `leadflow-redis` — data services (also runnable manually)

## Prioritized Backlog

### P0 — Blocking follow-ups
- Store production GitHub PAT via Integrations UI (currently MOCK_TOKEN)
- Set a real `ENCRYPTION_SECRET` in production env (currently uses fallback)

### P1 — High-value next tasks
- Search UI: refactor `SearchLeadsClient.tsx` to enqueue via `enqueueSearchJobAction` + poll `getSearchJobStatusAction` for progress bar (currently the UI still calls the synchronous action)
- Implement Callfluent HMAC signature verification (remove the TODO once the shared secret arrives)
- ~~GHL outbound sync worker~~ ✅ **Done in Phase 8**
- CSV export `/leads/export`
- Real email provider (SendGrid/Resend/Mailgun) + campaign send worker + tracking webhooks
- Extend GHL sync to also emit an `opportunity`/`pipeline` update (currently only creates/updates the contact)

### P2 — Later
- Full GHL 3-legged OAuth (currently direct token storage only)
- Reports generation + PDF export
- Team invitations flow
- Stripe billing on the subscription plans
- Audit-log write-through
- Suppression list management

# LeadFlow Pro

A complete production-ready **business lead generation and campaign management SaaS platform** built with Next.js 16 App Router, TypeScript, Tailwind CSS, Prisma 7, and PostgreSQL.

## 🚀 Quick Start

```bash
# 1. Install dependencies (already done)
npm install

# 2. Seed the database with demo data
npm run seed

# 3. Start development server
npm run dev
```

**Open:** http://localhost:3001

**Demo Login:**
- Email: `admin@acme.com`
- Password: `password123`

---

## 🏗️ Architecture

### Tech Stack
| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.2 (App Router) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS v4 |
| Database | PostgreSQL 16 |
| ORM | Prisma 7 (with pg adapter) |
| Auth | Custom JWT sessions (bcrypt + jose) |
| Charts | Recharts |
| Forms | React Hook Form + Zod |
| Icons | Lucide React |

### Key Design Decisions
- **Prisma 7** – Uses new `prisma.config.ts` for datasource config + `@prisma/adapter-pg` for direct PostgreSQL connection
- **Provider-agnostic** – `LeadProvider` and `EmailProvider` interfaces allow swapping data sources without code changes
- **Mock providers** – Full mock implementations for development; real providers can be plugged in
- **Multi-tenant** – Every query is scoped to `organizationId` from the session
- **Custom JWT auth** – No NextAuth dependency, simple cookie-based JWT sessions

---

## 📁 Project Structure

```
src/
├── app/
│   ├── (auth)/              # Login, Register pages + auth actions
│   │   ├── login/
│   │   ├── register/
│   │   └── actions.ts       # Server actions for auth
│   ├── (dashboard)/         # Protected app pages
│   │   ├── layout.tsx       # Dashboard shell (sidebar + header)
│   │   ├── dashboard/       # Main dashboard
│   │   ├── campaigns/       # Campaign management
│   │   ├── search/          # Lead search + background jobs
│   │   ├── leads/           # Saved leads table + lead profiles
│   │   ├── email-campaigns/ # Email outreach management
│   │   ├── email-templates/ # Email template library
│   │   ├── reports/         # Analytics and reports
│   │   ├── team/            # Team member management
│   │   ├── integrations/    # Integration settings
│   │   ├── subscription/    # Plan and usage management
│   │   └── settings/        # Account and org settings
│   └── api/
│       └── email-campaigns/ # REST API routes
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx      # Collapsible dark sidebar
│   │   └── Header.tsx       # Top navigation header
│   └── campaigns/
│       ├── CampaignCard.tsx # Campaign card component
│       └── CampaignForm.tsx # Campaign create/edit form
└── lib/
    ├── auth.ts              # JWT session management
    ├── prisma.ts            # Prisma singleton client
    ├── utils.ts             # Utility functions
    ├── lead-provider.ts     # Provider-agnostic lead search
    └── email-provider.ts    # Provider-agnostic email sending
```

---

## 🔐 Authentication

Custom JWT-based auth system:
- Passwords hashed with **bcrypt** (12 rounds)
- Sessions stored as **httpOnly cookies** (7 day expiry)
- Every dashboard route protected with `requireSession()`
- Organization-scoped data access on every query

**Roles:** OWNER · ADMINISTRATOR · MANAGER · AGENT · VIEWER

---

## 📊 Database Schema

20 Prisma models covering:
- Users, Organizations, OrganizationMembers
- Campaigns, Leads, CampaignLeads
- SearchJobs, SearchResults
- EmailTemplates, EmailCampaigns, EmailRecipients, EmailEvents
- Tags, LeadNotes, LeadStatusHistory
- Reports, Integrations, Subscriptions, UsageRecords
- SuppressionEntries, AuditLogs

---

## 🔌 Adding Real Providers

### Lead Provider
Implement the `LeadProvider` interface in `src/lib/lead-provider.ts`:
```typescript
class MyLeadProvider implements LeadProvider {
  name = "my-provider";
  async searchBusinesses(params: BusinessSearchParams): Promise<SearchResult> { ... }
  async getBusinessDetails(sourceId: string): Promise<BusinessLead | null> { ... }
  async getUsage(): Promise<UsageInfo> { ... }
}
```

### Email Provider
Implement the `EmailProvider` interface in `src/lib/email-provider.ts`:
```typescript
class MyEmailProvider implements EmailProvider {
  name = "my-provider";
  async sendEmail(options: SendEmailOptions): Promise<EmailSendResult> { ... }
  async sendBatch(options: BatchSendOptions): Promise<EmailSendResult[]> { ... }
  async getDeliveryStatus(messageId: string): Promise<DeliveryStatus | null> { ... }
  verifyWebhook(payload: unknown, signature: string): boolean { ... }
  async getUsage(): Promise<EmailUsage> { ... }
}
```

Then update the `getLeadProvider()` or `getEmailProvider()` factory function to return your implementation.

---

## 🌐 Available Routes

| Route | Description |
|-------|-------------|
| `/login` | Authentication login page |
| `/register` | New organization registration |
| `/dashboard` | Main dashboard with KPIs and charts |
| `/campaigns` | Campaign list and management |
| `/campaigns/new` | Create new campaign |
| `/campaigns/[id]` | Campaign detail and workspace |
| `/search` | Lead search with background jobs |
| `/leads` | Saved leads table |
| `/leads/[id]` | Lead profile page |
| `/email-campaigns` | Email campaign list |
| `/email-campaigns/new` | Create email campaign |
| `/email-templates` | Template library |
| `/reports` | Analytics and reports |
| `/team` | Team member management |
| `/integrations` | Integration settings |
| `/subscription` | Plan and usage management |
| `/settings` | Account and org settings |

---

## 🛠️ Environment Variables

```env
DATABASE_URL="postgresql://user:password@host:5432/leadflow_db?schema=public"
NEXTAUTH_SECRET="your-secret-32-chars"
NEXTAUTH_URL="http://localhost:3001"
EMAIL_PROVIDER="mock"      # or "sendgrid", "mailgun", "resend"
LEAD_PROVIDER="mock"       # or "google-places", custom
```

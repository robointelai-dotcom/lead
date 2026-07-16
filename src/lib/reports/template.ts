/**
 * Growth Report HTML Template
 * ---------------------------
 * Niche-aware, self-contained HTML+CSS document. Renders the audit
 * result from `src/lib/reports/audit.ts` into a printable, mobile-
 * friendly page with a print stylesheet so `window.print()` produces
 * a clean PDF via the browser.
 *
 * Niche config controls terminology so the same generator works for
 * dental, restaurant, lawyer, salon, etc. The visual design matches
 * the sample provided by the client (Practice Pulse) — teal/amber
 * paper palette, serif headings, card grid, score dial.
 */

import type { AuditResult } from "./audit";

// ─── Niche configuration ────────────────────────────────────────────────

export interface NicheConfig {
  reportEyebrow: string;             // "PRACTICE PULSE · DIGITAL HEALTH & AI MATURITY REPORT"
  entityLabel: string;               // "Practice" | "Restaurant" | "Firm"
  chairCountPhrase: string;          // "chair count" | "cover count" | "case count"
  audienceNoun: string;              // "patients" | "diners" | "clients"
  gbpSectionTitle: string;           // localized to niche
  aiCoverageLine: string;            // "24/7 AI voice receptionist" etc.
  services: Array<{ name: string; description: string }>; // "Close the AI gap" service pills
}

const DENTAL_NICHE: NicheConfig = {
  reportEyebrow: "PRACTICE PULSE · DIGITAL HEALTH & AI MATURITY REPORT",
  entityLabel: "Practice",
  chairCountPhrase: "chair count",
  audienceNoun: "patients",
  gbpSectionTitle: "Local Presence & Google Business Profile",
  aiCoverageLine: "24/7 AI voice receptionist",
  services: [
    { name: "AI Calling", description: "Never miss a call — instant text-back & AI voice receptionist" },
    { name: "AI Appointments", description: "One unified, real-time booking system, no more split tools" },
    { name: "AI-Ready Website", description: "Fix the broken form, add a 24/7 chatbot & qualified intake" },
    { name: "AI Reputation", description: "Turn Facebook into a real review channel, close the response gap" },
    { name: "SEO Backlinks", description: "Close the citation gaps on Healthgrades, Zocdoc & more" },
    { name: "AISEO / GEO", description: "Structure content so AI Overviews & ChatGPT cite you first" },
  ],
};

const GENERIC_NICHE: NicheConfig = {
  reportEyebrow: "BUSINESS PULSE · DIGITAL HEALTH & AI MATURITY REPORT",
  entityLabel: "Business",
  chairCountPhrase: "revenue",
  audienceNoun: "customers",
  gbpSectionTitle: "Local Presence & Google Business Profile",
  aiCoverageLine: "24/7 AI voice + chat coverage",
  services: [
    { name: "AI Calling", description: "Never miss a call — instant text-back & AI voice receptionist" },
    { name: "AI Appointments", description: "One unified, real-time booking system" },
    { name: "AI-Ready Website", description: "Fix the broken form, add 24/7 chatbot & qualified intake" },
    { name: "AI Reputation", description: "Turn social channels into real review pipelines" },
    { name: "SEO Backlinks", description: "Close the citation gaps on top industry directories" },
    { name: "AISEO / GEO", description: "Structure content so AI Overviews & ChatGPT cite you first" },
  ],
};

const RESTAURANT_NICHE: NicheConfig = {
  ...GENERIC_NICHE,
  reportEyebrow: "RESTAURANT PULSE · DIGITAL HEALTH & AI MATURITY REPORT",
  entityLabel: "Restaurant",
  chairCountPhrase: "cover count",
  audienceNoun: "diners",
};

const LAWYER_NICHE: NicheConfig = {
  ...GENERIC_NICHE,
  reportEyebrow: "FIRM PULSE · DIGITAL HEALTH & AI MATURITY REPORT",
  entityLabel: "Firm",
  chairCountPhrase: "case load",
  audienceNoun: "clients",
};

export function resolveNiche(niche: string): NicheConfig {
  const n = niche.toLowerCase().trim();
  if (n.includes("dent")) return DENTAL_NICHE;
  if (n.includes("restaurant") || n.includes("food") || n.includes("cafe") || n.includes("bakery")) return RESTAURANT_NICHE;
  if (n.includes("law") || n.includes("legal") || n.includes("attorney")) return LAWYER_NICHE;
  return GENERIC_NICHE;
}

// ─── Utilities ──────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function statusClass(good: boolean, warn = false): string {
  if (good) return "status-good";
  if (warn) return "status-warn";
  return "status-bad";
}

function pillClass(status: "found" | "missing" | "active" | "warn"): string {
  if (status === "found" || status === "active") return "pill-good";
  if (status === "warn") return "pill-warn";
  return "pill-bad";
}

function dialSvg(score: number): string {
  const radius = 68;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  return `
  <svg viewBox="0 0 160 160" width="160" height="160" aria-label="Pulse score: ${score} out of 100">
    <circle cx="80" cy="80" r="${radius}" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="12" />
    <circle cx="80" cy="80" r="${radius}" fill="none" stroke="#E2A63D" stroke-width="12"
      stroke-linecap="round" stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
      transform="rotate(-90 80 80)" />
    <text x="80" y="90" text-anchor="middle" fill="#F3F0E4" font-family="Georgia,serif" font-size="42" font-weight="700">${score}</text>
    <text x="80" y="115" text-anchor="middle" fill="#F3F0E4" font-family="Segoe UI,Helvetica,Arial,sans-serif" font-size="11" opacity="0.7">/ 100 pulse</text>
  </svg>`;
}

// ─── Main render ────────────────────────────────────────────────────────

export interface RenderReportInput {
  reportId: string;
  slug: string;
  audit: AuditResult;
  niche: string;
  business: {
    name: string;
    address?: string;
    website?: string;
    phone?: string;
  };
  agency: {
    name: string;
    tagline: string;
    website: string;
    bookingUrl?: string;
  };
  generatedAt: Date;
  publicUrl: string;
}

export function renderReportHtml(input: RenderReportInput): string {
  const nicheCfg = resolveNiche(input.niche);
  const a = input.audit;
  const b = input.business;
  const ag = input.agency;

  const bookingUrl = ag.bookingUrl || "https://robointelai.com/book";

  const escapedName = escapeHtml(b.name);
  const escapedAddress = escapeHtml(b.address || "");
  const escapedWebsite = escapeHtml(b.website || "");
  const escapedPhone = escapeHtml(b.phone || "");

  const dateStr = input.generatedAt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${escapedName} — Growth Report</title>
<style>
  :root {
    --paper: #FBFAF6;
    --paper-dim: #F1EEE5;
    --ink: #13232B;
    --ink-soft: #4B5B60;
    --teal: #0E6F6E;
    --teal-deep: #0A4F4F;
    --amber: #E2A63D;
    --amber-soft: #F7E3B8;
    --green: #2E8B57;
    --green-soft: #DCEEE1;
    --red: #C1483A;
    --red-soft: #F6DEDA;
    --line: #E1DCCE;
    --serif: Georgia, 'Iowan Old Style', 'Times New Roman', serif;
    --sans: 'Segoe UI', Helvetica, Arial, sans-serif;
    --mono: 'Courier New', monospace;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #EDE9DD; font-family: var(--sans); color: var(--ink); -webkit-font-smoothing: antialiased; }
  a { color: var(--teal); }
  .sheet { max-width: 880px; margin: 24px auto; background: var(--paper); border-radius: 12px; box-shadow: 0 12px 40px rgba(19,35,43,0.12); overflow: hidden; }
  .letterhead { background: linear-gradient(135deg, var(--teal-deep), var(--teal)); color: #F3F0E4; padding: 40px 48px 32px; }
  .eyebrow { font-family: var(--mono); font-size: 11px; letter-spacing: 1.5px; opacity: 0.75; margin-bottom: 16px; }
  .lh-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 32px; }
  .practice-name { font-family: var(--serif); font-size: 34px; margin: 0 0 6px; line-height: 1.15; }
  .practice-meta { font-size: 13px; opacity: 0.85; line-height: 1.6; }
  .agency-tag { text-align: right; font-size: 12px; opacity: 0.85; }
  .agency-tag strong { display: block; font-family: var(--serif); font-size: 20px; letter-spacing: 1px; opacity: 1; margin-bottom: 4px; }
  .score-row { display: flex; align-items: center; gap: 28px; margin-top: 28px; }
  .dial-wrap { flex: 0 0 auto; }
  .score-caption { font-size: 15px; line-height: 1.55; opacity: 0.95; max-width: 500px; }
  .pulse-tags { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 14px; }
  .pulse-tag { font-size: 11px; padding: 4px 10px; border-radius: 999px; background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.2); }
  .pulse-tag-warn { background: rgba(226,166,61,0.28); border-color: rgba(226,166,61,0.5); }
  .pulse-tag-bad { background: rgba(193,72,58,0.32); border-color: rgba(193,72,58,0.55); }

  .body { padding: 40px 48px; }
  .section-head { display: flex; align-items: center; gap: 14px; margin: 28px 0 6px; }
  .section-num { width: 34px; height: 34px; border-radius: 50%; background: var(--ink); color: var(--paper); font-family: var(--mono); font-size: 13px; display: inline-flex; align-items: center; justify-content: center; }
  .section-head h2 { margin: 0; font-family: var(--serif); font-size: 22px; }
  .section-sub { color: var(--ink-soft); font-size: 13px; margin: 0 0 18px; line-height: 1.5; }

  .grid { display: grid; gap: 14px; }
  .grid-3 { grid-template-columns: repeat(3, 1fr); }
  .grid-2 { grid-template-columns: repeat(2, 1fr); }

  .card { border: 1px solid var(--line); border-left: 4px solid var(--line); border-radius: 10px; padding: 16px; background: #fff; }
  .card.status-good { border-left-color: var(--green); }
  .card.status-warn { border-left-color: var(--amber); }
  .card.status-bad  { border-left-color: var(--red); }
  .card .label { font-size: 10.5px; letter-spacing: 1px; color: var(--ink-soft); text-transform: uppercase; margin-bottom: 6px; }
  .card .value { font-family: var(--serif); font-size: 26px; line-height: 1.2; }
  .card .note { color: var(--ink-soft); font-size: 12px; margin-top: 6px; line-height: 1.4; }
  .meter { height: 6px; background: var(--paper-dim); border-radius: 999px; margin-top: 10px; overflow: hidden; }
  .meter > span { display: block; height: 100%; background: var(--teal); }

  .pill { display: inline-block; font-size: 11px; padding: 3px 10px; border-radius: 999px; margin-top: 6px; font-weight: 600; }
  .pill-good { background: var(--green-soft); color: var(--green); }
  .pill-warn { background: var(--amber-soft); color: #7A5A11; }
  .pill-bad  { background: var(--red-soft); color: var(--red); }

  .timeline { display: flex; justify-content: space-between; gap: 8px; margin: 14px 0 8px; padding: 14px 0; border-top: 1px dashed var(--line); border-bottom: 1px dashed var(--line); }
  .tl-seg { flex: 1; text-align: center; }
  .tl-seg .dot { width: 12px; height: 12px; border-radius: 50%; background: var(--teal); margin: 0 auto 8px; }
  .tl-seg .t { font-family: var(--serif); font-size: 16px; }
  .tl-seg .l { font-size: 10.5px; color: var(--ink-soft); text-transform: uppercase; letter-spacing: 0.8px; margin-top: 4px; }

  .ai-row { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 12px 0; border-bottom: 1px solid var(--line); }
  .ai-row:last-child { border-bottom: none; }
  .ai-row .left { display: flex; gap: 12px; align-items: center; }
  .icon-badge { width: 28px; height: 28px; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; font-weight: 700; font-size: 15px; }
  .badge-missing { background: var(--red-soft); color: var(--red); }
  .badge-active { background: var(--green-soft); color: var(--green); }
  .ai-row .name { font-weight: 600; font-size: 14px; }
  .ai-row .desc { font-size: 12px; color: var(--ink-soft); margin-top: 2px; }
  .cta-chip { font-size: 11px; padding: 6px 12px; border-radius: 6px; background: var(--teal); color: #F3F0E4; white-space: nowrap; }

  .findings { list-style: none; padding: 0; margin: 6px 0 0; }
  .findings li { font-size: 13px; color: var(--ink-soft); padding: 6px 0 6px 22px; position: relative; line-height: 1.5; }
  .findings li:before { content: "•"; color: var(--amber); position: absolute; left: 8px; font-weight: 700; }
  .findings li.good:before { color: var(--green); content: "✓"; }

  .cit-table { width: 100%; border-collapse: collapse; margin: 8px 0 16px; }
  .cit-table td { padding: 10px 0; border-bottom: 1px solid var(--line); font-size: 13px; }
  .cit-table td:last-child { text-align: right; }
  .cit-status.missing { color: var(--red); font-weight: 600; }
  .cit-status.found { color: var(--green); font-weight: 600; }

  .cta-band { background: linear-gradient(135deg, var(--teal-deep), var(--teal)); color: #F3F0E4; padding: 36px 48px; }
  .cta-band h3 { font-family: var(--serif); font-size: 26px; margin: 0 0 10px; }
  .cta-band p { font-size: 14px; line-height: 1.55; opacity: 0.9; max-width: 640px; margin: 0 0 20px; }
  .cta-services { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px 24px; margin: 20px 0 28px; }
  .cta-service { border-left: 3px solid var(--amber); padding: 4px 0 4px 12px; }
  .cta-service strong { display: block; font-family: var(--serif); font-size: 15px; margin-bottom: 2px; }
  .cta-service span { font-size: 12.5px; opacity: 0.85; line-height: 1.4; }
  .cta-btn { display: inline-block; background: var(--amber); color: #3A2A05; font-weight: 700; font-size: 14px; padding: 14px 26px; border-radius: 8px; text-decoration: none; }
  .cta-btn:hover { background: #F0B550; }
  .cta-btn.secondary { background: transparent; color: #F3F0E4; border: 1px solid rgba(255,255,255,0.35); margin-left: 10px; }

  .report-footer { padding: 20px 48px; border-top: 1px solid var(--line); background: var(--paper-dim); display: flex; justify-content: space-between; font-size: 11px; color: var(--ink-soft); }
  .report-footer a { color: var(--ink-soft); }

  .toolbar { max-width: 880px; margin: 16px auto 0; display: flex; justify-content: flex-end; gap: 8px; }
  .toolbar button { background: var(--ink); color: var(--paper); border: none; padding: 8px 16px; border-radius: 6px; font-size: 13px; cursor: pointer; font-family: var(--sans); }
  .toolbar button:hover { background: var(--teal-deep); }
  .toolbar button.secondary { background: transparent; color: var(--ink); border: 1px solid var(--line); }

  @media (max-width: 720px) {
    .lh-top, .score-row { flex-direction: column; align-items: flex-start; }
    .grid-3, .grid-2, .cta-services { grid-template-columns: 1fr; }
    .letterhead, .body, .cta-band, .report-footer { padding-left: 24px; padding-right: 24px; }
    .practice-name { font-size: 26px; }
    .cta-band h3 { font-size: 22px; }
    .toolbar { padding: 0 24px; }
  }

  @media print {
    body { background: #fff; }
    .sheet { box-shadow: none; margin: 0; border-radius: 0; max-width: 100%; }
    .toolbar { display: none; }
    .cta-band, .letterhead { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .section-head { page-break-after: avoid; }
    .card, .ai-row, .cit-table tr { page-break-inside: avoid; }
  }
</style>
</head>
<body>

<div class="toolbar">
  <button class="secondary" onclick="window.print()" data-testid="report-print-btn">📄 Save as PDF</button>
  <button onclick="navigator.clipboard.writeText(window.location.href).then(()=>alert('Link copied!'))" data-testid="report-copy-link-btn">🔗 Copy Link</button>
</div>

<div class="sheet">
  <header class="letterhead">
    <div class="eyebrow">${escapeHtml(nicheCfg.reportEyebrow)}</div>
    <div class="lh-top">
      <div>
        <h1 class="practice-name">${escapedName}</h1>
        <div class="practice-meta">
          ${escapedAddress ? `<div>${escapedAddress}</div>` : ""}
          ${escapedWebsite ? `<div>${escapedWebsite}</div>` : ""}
          ${escapedPhone ? `<div>${escapedPhone}</div>` : ""}
          <div style="margin-top:8px;">Report date · ${dateStr}</div>
          <div>Prepared by · ${escapeHtml(ag.name)}</div>
        </div>
      </div>
      <div class="agency-tag">
        <strong>${escapeHtml(ag.name).toUpperCase()}</strong>
        <div>${escapeHtml(ag.tagline)}</div>
        <div><a href="${escapeHtml(ag.website)}" style="color:#F3F0E4;">${escapeHtml(ag.website)}</a></div>
      </div>
    </div>
    <div class="score-row">
      <div class="dial-wrap">${dialSvg(a.pulseScore)}</div>
      <div>
        <div class="score-caption">${escapeHtml(a.scoreCaption)}</div>
        <div class="pulse-tags">
          ${a.pulseTags
            .map(
              (t) =>
                `<span class="pulse-tag ${
                  t.kind === "warn" ? "pulse-tag-warn" : t.kind === "bad" ? "pulse-tag-bad" : ""
                }">${t.kind === "good" ? "✓" : t.kind === "warn" ? "⚠" : "✕"} ${escapeHtml(t.text)}</span>`
            )
            .join("")}
        </div>
      </div>
    </div>
  </header>

  <div class="body">

    <!-- SECTION 1: GBP -->
    <div class="section-head"><span class="section-num">01</span><h2>${escapeHtml(nicheCfg.gbpSectionTitle)}</h2></div>
    <p class="section-sub">Your visibility inside the 3-pack, review pipeline health, and public listing completeness.</p>
    <div class="grid grid-3">
      <div class="card ${statusClass(a.gbp.mapRank === "Top 3", a.gbp.mapRank.startsWith("4"))}">
        <div class="label">Map Pack Rank</div><div class="value">${a.gbp.mapRank}</div>
        <div class="note">Your visibility in the top-3 Google Maps results for niche + city queries.</div>
      </div>
      <div class="card ${statusClass(a.gbp.reviewVelocity >= 10, a.gbp.reviewVelocity >= 4)}">
        <div class="label">Review Velocity</div><div class="value">${a.gbp.reviewVelocity}/mo</div>
        <div class="note">New reviews per 30 days — key AI-Overview ranking signal.</div>
      </div>
      <div class="card ${statusClass(a.gbp.reviewResponseRate >= 70, a.gbp.reviewResponseRate >= 40)}">
        <div class="label">Response Rate</div><div class="value">${a.gbp.reviewResponseRate}%</div>
        <div class="meter"><span style="width:${a.gbp.reviewResponseRate}%"></span></div>
      </div>
      <div class="card ${statusClass(a.gbp.rating >= 4.5, a.gbp.rating >= 4)}">
        <div class="label">Rating</div><div class="value">${a.gbp.rating.toFixed(1)}★</div>
        <div class="note">${a.gbp.reviewCount} total reviews.</div>
      </div>
      <div class="card ${statusClass(a.gbp.photos >= 30, a.gbp.photos >= 10)}">
        <div class="label">GBP Photos</div><div class="value">${a.gbp.photos}</div>
        <div class="note">Listings with 30+ photos convert 2× more calls.</div>
      </div>
      <div class="card ${statusClass(a.gbp.posts >= 5, a.gbp.posts >= 2)}">
        <div class="label">GBP Posts (90d)</div><div class="value">${a.gbp.posts}</div>
        <div class="note">Weekly posts keep your profile fresh & AI-cited.</div>
      </div>
    </div>

    <!-- SECTION 2: Website Health & Core Web Vitals -->
    <div class="section-head"><span class="section-num">02</span><h2>Website Health &amp; Core Web Vitals</h2></div>
    <p class="section-sub">Mobile-first performance, accessibility, and technical SEO — the foundation AI Overviews evaluate.</p>
    <div class="grid grid-3">
      <div class="card ${statusClass(a.website.performance >= 80, a.website.performance >= 50)}">
        <div class="label">Performance</div><div class="value">${a.website.performance}</div>
        <div class="meter"><span style="width:${a.website.performance}%"></span></div>
      </div>
      <div class="card ${statusClass(a.website.accessibility >= 80, a.website.accessibility >= 60)}">
        <div class="label">Accessibility</div><div class="value">${a.website.accessibility}</div>
        <div class="meter"><span style="width:${a.website.accessibility}%"></span></div>
      </div>
      <div class="card ${statusClass(a.website.seo >= 80, a.website.seo >= 60)}">
        <div class="label">SEO</div><div class="value">${a.website.seo}</div>
        <div class="meter"><span style="width:${a.website.seo}%"></span></div>
      </div>
    </div>
    <div class="timeline">
      <div class="tl-seg"><div class="dot"></div><div class="t">${escapeHtml(a.website.firstPaint)}</div><div class="l">First Paint</div></div>
      <div class="tl-seg"><div class="dot"></div><div class="t">${escapeHtml(a.website.largestPaint)}</div><div class="l">Largest Paint</div></div>
      <div class="tl-seg"><div class="dot"></div><div class="t">${escapeHtml(a.website.interactive)}</div><div class="l">Interactive</div></div>
      <div class="tl-seg"><div class="dot"></div><div class="t">${escapeHtml(a.website.tapToCall)}</div><div class="l">Tap-to-Call</div></div>
    </div>
    <p class="section-sub">${a.website.reachable ? "Audited " + escapeHtml(a.website.urlChecked) : "⚠ Site was not reachable during the audit — scores are estimated."}</p>

    <!-- SECTION 3: Website & Lead Capture Health (NEW) -->
    <div class="section-head"><span class="section-num">03</span><h2>Website &amp; Lead Capture Health</h2></div>
    <p class="section-sub">How well your homepage converts a visitor into a booked appointment — the difference between a fast site and a profitable one.</p>
    <div class="grid grid-2">
      <div class="card ${statusClass(a.websiteHealth.hasContactForm, false)}">
        <div class="label">Contact Form</div>
        <div class="value">${a.websiteHealth.hasContactForm ? `Present (${a.websiteHealth.formFieldCount} fields)` : "Missing"}</div>
      </div>
      <div class="card ${statusClass(a.websiteHealth.hasClickToCall, false)}">
        <div class="label">Click-to-Call</div>
        <div class="value">${a.websiteHealth.hasClickToCall ? "Active" : "Missing"}</div>
      </div>
      <div class="card ${statusClass(a.websiteHealth.hasBookingWidget, false)}">
        <div class="label">Online Booking</div>
        <div class="value">${a.websiteHealth.hasBookingWidget ? "Detected" : "Missing"}</div>
      </div>
      <div class="card ${statusClass(a.websiteHealth.hasStickyMobileCta, false)}">
        <div class="label">Sticky Mobile CTA</div>
        <div class="value">${a.websiteHealth.hasStickyMobileCta ? "Detected" : "Missing"}</div>
      </div>
    </div>
    <ul class="findings">
      ${a.websiteHealth.findings.map((f) => `<li>${escapeHtml(f)}</li>`).join("")}
    </ul>

    <!-- SECTION 4: AI Overviews & Generative Engine Readiness (NEW) -->
    <div class="section-head"><span class="section-num">04</span><h2>AI Overviews &amp; Generative Engine Readiness</h2></div>
    <p class="section-sub">Whether Google's AI Overviews, ChatGPT, Perplexity and other LLMs can find, understand, and cite your ${escapeHtml(nicheCfg.entityLabel.toLowerCase())} when a ${escapeHtml(nicheCfg.audienceNoun.slice(0, -1))} asks about services in your area.</p>
    <div class="grid grid-2">
      <div class="card ${statusClass(a.aiOverviews.hasJsonLd)}">
        <div class="label">JSON-LD Structured Data</div>
        <div class="value">${a.aiOverviews.hasJsonLd ? "Present" : "Missing"}</div>
        <div class="note">Machine-readable data AI engines require to cite you.</div>
      </div>
      <div class="card ${statusClass(a.aiOverviews.hasSchemaMarkup)}">
        <div class="label">LocalBusiness Schema</div>
        <div class="value">${a.aiOverviews.hasSchemaMarkup ? "Present" : "Missing"}</div>
        <div class="note">Tells AI you're a real ${escapeHtml(nicheCfg.entityLabel.toLowerCase())} at a specific location.</div>
      </div>
      <div class="card ${statusClass(a.aiOverviews.hasFaqPage)}">
        <div class="label">FAQ / FAQPage Schema</div>
        <div class="value">${a.aiOverviews.hasFaqPage ? "Present" : "Missing"}</div>
        <div class="note">Powers zero-click answers in Google SGE &amp; AI Overviews.</div>
      </div>
      <div class="card ${statusClass(a.aiOverviews.hasStructuredContent, a.aiOverviews.hasJsonLd || a.aiOverviews.hasSchemaMarkup)}">
        <div class="label">AI Readiness Score</div>
        <div class="value">${a.aiOverviews.score}/100</div>
        <div class="meter"><span style="width:${a.aiOverviews.score}%"></span></div>
      </div>
    </div>
    <ul class="findings">
      ${a.aiOverviews.findings.map((f) => `<li>${escapeHtml(f)}</li>`).join("")}
    </ul>

    <!-- SECTION 5: AI & Automation Maturity -->
    <div class="section-head"><span class="section-num">05</span><h2>AI &amp; Automation Maturity</h2></div>
    <p class="section-sub">The 4 automation levers that separate practices growing 30-50% year-over-year from the rest.</p>
    <div>
      ${(["chatbot","missedCallTextBack","onlineScheduling","patientComms"] as const)
        .map((k) => {
          const item = a.aiMaturity[k];
          const label = { chatbot: "AI Chatbot", missedCallTextBack: "Missed-Call Text-Back", onlineScheduling: "Online Self-Scheduling", patientComms: "Patient Comms / PRM Stack" }[k];
          const chip = { chatbot: "Deploy AI Chatbot", missedCallTextBack: "Enable Text-Back", onlineScheduling: "Unify Booking", patientComms: "Integrate PRM" }[k];
          return `<div class="ai-row">
            <div class="left">
              <span class="icon-badge ${item.status === "active" ? "badge-active" : "badge-missing"}">${item.status === "active" ? "✓" : "✕"}</span>
              <div><div class="name">${label}</div><div class="desc">${escapeHtml(item.description)}</div></div>
            </div>
            ${item.status === "missing" ? `<span class="cta-chip">${chip}</span>` : ""}
          </div>`;
        })
        .join("")}
    </div>

    <!-- SECTION 6: Ad Tracking -->
    <div class="section-head"><span class="section-num">06</span><h2>Ad Tracking &amp; Paid Readiness</h2></div>
    <p class="section-sub">Whether your site can capture &amp; retarget the leads it earns.</p>
    <div class="grid grid-2">
      ${[
        ["Meta Pixel", a.adTracking.metaPixel],
        ["Google Ads Pixel", a.adTracking.googleAdsPixel],
        ["Google Analytics / GTM", a.adTracking.gaGtm],
        ["LSA / Google Screened", a.adTracking.lsa],
      ]
        .map(
          ([label, status]) =>
            `<div class="card ${statusClass(status === "active")}">
              <div class="label">${escapeHtml(String(label))}</div>
              <div class="value">${status === "active" ? "Active" : "Missing"}</div>
              <span class="pill ${pillClass(status === "active" ? "active" : "missing")}">${status === "active" ? "TRACKING" : "NOT INSTALLED"}</span>
            </div>`
        )
        .join("")}
    </div>

    <!-- SECTION 7: Citations -->
    <div class="section-head"><span class="section-num">07</span><h2>Local Citations Audit</h2></div>
    <p class="section-sub">Your presence on the directories AI engines cross-reference to trust your ${escapeHtml(nicheCfg.entityLabel.toLowerCase())}.</p>
    <table class="cit-table">
      ${a.citations.map((c) => `<tr><td>${escapeHtml(c.name)}</td><td><span class="cit-status ${c.status}">${c.status === "found" ? "✓ Found &amp; active" : "✕ Missing"}</span></td></tr>`).join("")}
    </table>

    <!-- SECTION 8: Narrative -->
    <div class="section-head"><span class="section-num">08</span><h2>What This Means For Your ${escapeHtml(nicheCfg.chairCountPhrase.replace(/\b\w/g, (c) => c.toUpperCase()))}</h2></div>
    <p class="section-sub">Real-world revenue implications of the above audit.</p>
    <div class="grid grid-3">
      <div class="card status-good">
        <div class="label">Bringing You ${escapeHtml(nicheCfg.audienceNoun.replace(/\b\w/g, (c) => c.toUpperCase()))}</div>
        <ul class="findings" style="margin-top:8px;">
          ${a.narrative.winning.map((f) => `<li class="good">${escapeHtml(f)}</li>`).join("")}
        </ul>
      </div>
      <div class="card status-bad">
        <div class="label">Where You're Losing ${escapeHtml(nicheCfg.audienceNoun.replace(/\b\w/g, (c) => c.toUpperCase()))}</div>
        <ul class="findings" style="margin-top:8px;">
          ${a.narrative.losing.map((f) => `<li>${escapeHtml(f)}</li>`).join("")}
        </ul>
      </div>
      <div class="card status-warn">
        <div class="label">How Competitors Are Winning</div>
        <ul class="findings" style="margin-top:8px;">
          ${a.narrative.competitorEdge.map((f) => `<li>${escapeHtml(f)}</li>`).join("")}
        </ul>
      </div>
    </div>

  </div>

  <!-- CTA BAND -->
  <section class="cta-band">
    <h3>Close the AI gap in 30 days</h3>
    <p>Robointech's stack is built to fix exactly what's flagged above — starting with the broken form and fragmented booking, then layering in ${escapeHtml(nicheCfg.aiCoverageLine)}.</p>
    <div class="cta-services">
      ${nicheCfg.services
        .map((s) => `<div class="cta-service"><strong>${escapeHtml(s.name)}</strong><span>${escapeHtml(s.description)}</span></div>`)
        .join("")}
    </div>
    <div>
      <a class="cta-btn" href="${escapeHtml(bookingUrl)}" target="_blank" rel="noopener" data-testid="report-book-btn">Book Free Strategy Call →</a>
      <a class="cta-btn secondary" href="${escapeHtml(ag.website)}" target="_blank" rel="noopener">Visit ${escapeHtml(ag.name)}</a>
    </div>
  </section>

  <footer class="report-footer">
    <div>© ${new Date().getFullYear()} ${escapeHtml(ag.name)} · Prepared for ${escapedName}</div>
    <div><a href="${escapeHtml(ag.website)}" target="_blank" rel="noopener">${escapeHtml(ag.website)}</a></div>
  </footer>
</div>

</body>
</html>`;
}

import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { FileText, ExternalLink, Mail, MailX, Clock, AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";
import { formatDate } from "@/lib/utils";
import GrowthReportsActions from "./GrowthReportsActions";

export const dynamic = "force-dynamic";

const STATUS_META: Record<
  string,
  { label: string; className: string; icon: typeof Clock }
> = {
  PENDING:    { label: "Queued",     className: "bg-gray-100 text-gray-700",     icon: Clock },
  GENERATING: { label: "Generating", className: "bg-blue-50 text-blue-700",       icon: Clock },
  READY:      { label: "Ready",      className: "bg-emerald-50 text-emerald-700", icon: CheckCircle2 },
  SENT:       { label: "Sent",       className: "bg-emerald-50 text-emerald-700", icon: Mail },
  FAILED:     { label: "Failed",     className: "bg-red-50 text-red-700",         icon: AlertCircle },
};

function scoreColor(score: number | null): string {
  if (score === null) return "bg-gray-100 text-gray-500";
  if (score >= 80) return "bg-emerald-50 text-emerald-700";
  if (score >= 60) return "bg-amber-50 text-amber-700";
  return "bg-red-50 text-red-700";
}

export default async function GrowthReportsPage() {
  const session = await requireSession();

  const [reports, aggregates] = await Promise.all([
    prisma.growthReport.findMany({
      where: { organizationId: session.organizationId },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        lead: {
          select: {
            id: true,
            businessName: true,
            email: true,
            phone: true,
            city: true,
            state: true,
            category: true,
          },
        },
      },
    }),
    prisma.growthReport.groupBy({
      by: ["status"],
      where: { organizationId: session.organizationId },
      _count: { _all: true },
    }),
  ]);

  const counts = Object.fromEntries(
    aggregates.map((a) => [a.status, a._count._all])
  );

  const totalViews = reports.reduce((n, r) => n + r.viewedCount, 0);
  const avgScore =
    reports.filter((r) => r.pulseScore !== null).length > 0
      ? Math.round(
          reports
            .filter((r) => r.pulseScore !== null)
            .reduce((n, r) => n + (r.pulseScore ?? 0), 0) /
            reports.filter((r) => r.pulseScore !== null).length
        )
      : null;

  return (
    <div className="space-y-6" data-testid="growth-reports-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Growth Reports</h1>
          <p className="text-gray-500 text-sm">
            Personalized digital-health &amp; AI-maturity audits — auto-generated for every lead you save.
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="Total Reports" value={reports.length} />
        <StatCard label="Sent to Lead" value={counts["SENT"] ?? 0} tone="ok" />
        <StatCard label="Awaiting Email" value={(counts["READY"] ?? 0)} tone="warn" />
        <StatCard label="Failed" value={counts["FAILED"] ?? 0} tone="bad" />
        <StatCard label="Avg Pulse Score" value={avgScore !== null ? `${avgScore}/100` : "—"} />
      </div>

      {/* Table */}
      <div className="card">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Recent reports</h2>
          <span className="text-xs text-gray-500">{totalViews} total views</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="growth-reports-table">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="text-left px-5 py-3">Business</th>
                <th className="text-left px-5 py-3">Niche</th>
                <th className="text-left px-5 py-3">Pulse</th>
                <th className="text-left px-5 py-3">Status</th>
                <th className="text-left px-5 py-3">Emailed</th>
                <th className="text-left px-5 py-3">Views</th>
                <th className="text-left px-5 py-3">Created</th>
                <th className="text-right px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center text-gray-500">
                    <FileText className="w-8 h-8 mx-auto text-gray-300 mb-3" />
                    <div>No reports yet.</div>
                    <div className="text-xs mt-1">
                      Save a lead from{" "}
                      <Link href="/search" className="text-amber-600 hover:underline">
                        Search
                      </Link>{" "}
                      and a growth report will auto-generate here.
                    </div>
                  </td>
                </tr>
              )}
              {reports.map((r) => {
                const meta = STATUS_META[r.status] || STATUS_META.PENDING;
                const StatusIcon = meta.icon;
                return (
                  <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-5 py-4">
                      <Link
                        href={`/leads/${r.lead.id}`}
                        className="font-medium text-gray-900 hover:text-amber-600"
                      >
                        {r.lead.businessName}
                      </Link>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {r.lead.city}
                        {r.lead.state ? `, ${r.lead.state}` : ""}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-gray-700 capitalize">{r.niche || "—"}</td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-semibold ${scoreColor(r.pulseScore)}`}
                      >
                        {r.pulseScore !== null ? `${r.pulseScore}/100` : "—"}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${meta.className}`}
                      >
                        <StatusIcon className="w-3 h-3" />
                        {meta.label}
                      </span>
                      {r.errorMessage && (
                        <div className="text-[10px] text-red-500 mt-1 max-w-[240px] truncate" title={r.errorMessage}>
                          {r.errorMessage}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4 text-xs text-gray-600">
                      {r.emailedTo ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600">
                          <Mail className="w-3 h-3" />
                          {r.emailedAt ? formatDate(r.emailedAt) : "yes"}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-gray-400">
                          <MailX className="w-3 h-3" />
                          {r.lead.email ? "not sent" : "no email"}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-gray-600">{r.viewedCount}</td>
                    <td className="px-5 py-4 text-gray-600">{formatDate(r.createdAt)}</td>
                    <td className="px-5 py-4 text-right">
                      <GrowthReportsActions
                        reportId={r.id}
                        leadId={r.lead.id}
                        canOpen={r.status === "READY" || r.status === "SENT"}
                        canResend={(r.status === "READY" || r.status === "FAILED") && !!r.lead.email}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: "ok" | "warn" | "bad";
}) {
  const toneMap = {
    ok: "text-emerald-600",
    warn: "text-amber-600",
    bad: "text-red-600",
  };
  return (
    <div className="card p-4">
      <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-2xl font-bold ${tone ? toneMap[tone] : "text-gray-900"}`}>{value}</div>
    </div>
  );
}

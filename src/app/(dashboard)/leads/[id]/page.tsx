import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Mail, Phone, Globe, MapPin, Star, Tag, Building2, Calendar, FileText, ExternalLink, Clock, AlertCircle } from "lucide-react";
import { formatDate, formatNumber } from "@/lib/utils";
import LeadStatusPicker from "./LeadStatusPicker";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = await prisma.lead.findUnique({ where: { id }, select: { businessName: true } });
  return { title: lead?.businessName || "Lead Profile" };
}

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();

  const lead = await prisma.lead.findFirst({
    where: { id, organizationId: session.organizationId },
    include: {
      campaignLeads: {
        include: {
          campaign: { select: { id: true, name: true } },
          leadNotes: { include: { user: true }, orderBy: { createdAt: "desc" } },
          statusHistory: { orderBy: { changedAt: "desc" } },
          assignedUser: true,
        },
      },
      tags: { include: { tag: true } },
      growthReports: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!lead) notFound();

  const latestCampaignLead = lead.campaignLeads[0];
  const latestReport = lead.growthReports[0] || null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/leads" className="btn-ghost p-2">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{lead.businessName}</h1>
          {lead.category && <p className="text-gray-500 text-sm">{lead.category}</p>}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {lead.isVerified && <span className="badge badge-green">✓ Verified</span>}
          {lead.isClaimed && <span className="badge badge-blue">Claimed</span>}
          <span className="badge badge-amber">Score: {lead.qualityScore}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main info */}
        <div className="lg:col-span-2 space-y-5">
          {/* Contact info */}
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Contact Information</h3>
            <div className="grid grid-cols-2 gap-4">
              {lead.email && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Mail className="w-4 h-4 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-medium">Email</p>
                    <a href={`mailto:${lead.email}`} className="text-sm text-blue-600 hover:underline break-all">{lead.email}</a>
                  </div>
                </div>
              )}
              {lead.phone && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Phone className="w-4 h-4 text-green-500" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-medium">Phone</p>
                    <a href={`tel:${lead.phone}`} className="text-sm text-green-600">{lead.phone}</a>
                  </div>
                </div>
              )}
              {lead.website && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Globe className="w-4 h-4 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-medium">Website</p>
                    <a href={lead.website} target="_blank" rel="noopener noreferrer" className="text-sm text-purple-600 hover:underline">{lead.website}</a>
                  </div>
                </div>
              )}
              {lead.address && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-4 h-4 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-medium">Address</p>
                    <p className="text-sm text-gray-700">{lead.address}, {lead.city}, {lead.state} {lead.postalCode}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Social media */}
            {(lead.facebook || lead.instagram || lead.twitter || lead.linkedin) && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-400 font-medium mb-2">Social Media</p>
                <div className="flex gap-2">
                  {lead.facebook && <a href={lead.facebook} target="_blank" rel="noopener noreferrer" className="badge badge-blue">Facebook</a>}
                  {lead.instagram && <a href={lead.instagram} target="_blank" rel="noopener noreferrer" className="badge badge-pink">Instagram</a>}
                  {lead.twitter && <a href={lead.twitter} target="_blank" rel="noopener noreferrer" className="badge badge-blue">Twitter</a>}
                  {lead.linkedin && <a href={lead.linkedin} target="_blank" rel="noopener noreferrer" className="badge badge-blue">LinkedIn</a>}
                </div>
              </div>
            )}
          </div>

          {/* Business info */}
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Business Information</h3>
            <div className="grid grid-cols-2 gap-4">
              {lead.rating && (
                <div>
                  <p className="text-xs text-gray-400 font-medium">Rating</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                    <span className="font-semibold">{lead.rating}</span>
                    {lead.reviewCount && <span className="text-xs text-gray-400">({formatNumber(lead.reviewCount)} reviews)</span>}
                  </div>
                </div>
              )}
              <div>
                <p className="text-xs text-gray-400 font-medium">Quality Score</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-2 bg-gray-100 rounded-full">
                    <div className="h-full bg-amber-400 rounded-full" style={{ width: `${lead.qualityScore}%` }} />
                  </div>
                  <span className="font-semibold text-sm">{lead.qualityScore}/100</span>
                </div>
              </div>
              {lead.description && (
                <div className="col-span-2">
                  <p className="text-xs text-gray-400 font-medium">Description</p>
                  <p className="text-sm text-gray-700 mt-1">{lead.description}</p>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          {latestCampaignLead?.leadNotes && latestCampaignLead.leadNotes.length > 0 && (
            <div className="card p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Notes</h3>
              <div className="space-y-3">
                {latestCampaignLead.leadNotes.map((note) => (
                  <div key={note.id} className="p-3 bg-gray-50 rounded-xl">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-gray-700">{note.user.name || note.user.email}</span>
                      <span className="text-xs text-gray-400">{formatDate(note.createdAt)}</span>
                    </div>
                    <p className="text-sm text-gray-600">{note.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Growth Report card */}
          <div className="card p-5" data-testid="lead-growth-report-card">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-teal-700" />
              <h3 className="font-semibold text-gray-900">Growth Report</h3>
            </div>
            {latestReport ? (
              <div>
                {latestReport.pulseScore !== null && (
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`text-2xl font-bold ${
                      latestReport.pulseScore >= 80 ? "text-emerald-600"
                        : latestReport.pulseScore >= 60 ? "text-amber-600"
                        : "text-red-600"
                    }`}>
                      {latestReport.pulseScore}
                    </div>
                    <div className="text-xs text-gray-500">/ 100 pulse score</div>
                  </div>
                )}
                <div className="flex items-center gap-2 text-xs mb-3">
                  {latestReport.status === "SENT" && (
                    <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-1 rounded">
                      <Mail className="w-3 h-3" /> Emailed {latestReport.emailedAt ? formatDate(latestReport.emailedAt) : ""}
                    </span>
                  )}
                  {latestReport.status === "READY" && (
                    <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-1 rounded">
                      ✓ Ready
                    </span>
                  )}
                  {(latestReport.status === "PENDING" || latestReport.status === "GENERATING") && (
                    <span className="inline-flex items-center gap-1 text-blue-700 bg-blue-50 px-2 py-1 rounded">
                      <Clock className="w-3 h-3" /> Generating…
                    </span>
                  )}
                  {latestReport.status === "FAILED" && (
                    <span className="inline-flex items-center gap-1 text-red-700 bg-red-50 px-2 py-1 rounded" title={latestReport.errorMessage || undefined}>
                      <AlertCircle className="w-3 h-3" /> Failed
                    </span>
                  )}
                </div>
                <a
                  href={`/r/${latestReport.id}`}
                  target="_blank"
                  rel="noopener"
                  className="btn-primary inline-flex items-center gap-1.5 text-xs w-full justify-center"
                  data-testid="lead-open-report-btn"
                >
                  <ExternalLink className="w-3 h-3" /> Open Report
                </a>
                <p className="text-[10px] text-gray-400 mt-2">
                  {latestReport.viewedCount} view{latestReport.viewedCount === 1 ? "" : "s"} · manage from{" "}
                  <Link href="/growth-reports" className="text-amber-600 hover:underline">Growth Reports</Link>
                </p>
              </div>
            ) : (
              <p className="text-sm text-gray-400">No report yet — one will auto-generate shortly.</p>
            )}
          </div>

          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Campaign Memberships</h3>
            {lead.campaignLeads.length === 0 ? (
              <p className="text-sm text-gray-400">Not in any campaign</p>
            ) : (
              <div className="space-y-3">
                {lead.campaignLeads.map((cl) => (
                  <div key={cl.id} className="p-3 bg-gray-50 rounded-lg">
                    <Link href={`/campaigns/${cl.campaign.id}`} className="text-sm font-medium text-amber-600 hover:text-amber-700">
                      {cl.campaign.name}
                    </Link>
                    <div className="mt-2">
                      <LeadStatusPicker campaignLeadId={cl.id} currentStatus={cl.status} />
                    </div>
                    <p className="text-xs text-gray-400 mt-2">Added {formatDate(cl.createdAt)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {lead.tags.length > 0 && (
            <div className="card p-5">
              <h3 className="font-semibold text-gray-900 mb-3">Tags</h3>
              <div className="flex flex-wrap gap-1.5">
                {lead.tags.map((lt) => (
                  <span
                    key={lt.tag.id}
                    className="px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{ backgroundColor: lt.tag.color + "20", color: lt.tag.color }}
                  >
                    {lt.tag.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Source</h3>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-xs text-gray-400">Provider</dt>
                <dd className="text-gray-700 capitalize">{lead.sourceProvider || "Unknown"}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400">Added</dt>
                <dd className="text-gray-700">{formatDate(lead.createdAt)}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}

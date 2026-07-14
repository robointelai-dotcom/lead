import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Plus, Mail, Play, Pause, CheckCircle, Clock, X } from "lucide-react";
import { formatDate, formatNumber, formatPercent } from "@/lib/utils";

export const metadata = { title: "Email Campaigns" };

const statusColors: Record<string, string> = {
  DRAFT: "badge-gray",
  SCHEDULED: "badge-blue",
  SENDING: "badge-amber",
  PAUSED: "badge-amber",
  COMPLETED: "badge-green",
  CANCELLED: "badge-red",
};

export default async function EmailCampaignsPage() {
  const session = await requireSession();

  const campaigns = await prisma.emailCampaign.findMany({
    where: { organizationId: session.organizationId },
    orderBy: { createdAt: "desc" },
    include: { campaign: { select: { name: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Email Campaigns</h1>
          <p className="text-gray-500 text-sm">{campaigns.length} campaigns</p>
        </div>
        <Link href="/email-campaigns/new" className="btn-primary">
          <Plus className="w-4 h-4" /> New Email Campaign
        </Link>
      </div>

      {campaigns.length === 0 ? (
        <div className="card">
          <div className="empty-state py-16">
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-4">
              <Mail className="w-8 h-8 text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">No email campaigns yet</h3>
            <p className="text-gray-400 text-sm mb-6">Create your first email campaign to start reaching out to leads</p>
            <Link href="/email-campaigns/new" className="btn-primary">
              <Plus className="w-4 h-4" /> Create Email Campaign
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((ec) => {
            const openRate = ec.totalSent > 0 ? (ec.totalOpened / ec.totalSent) * 100 : 0;
            const replyRate = ec.totalSent > 0 ? (ec.totalReplied / ec.totalSent) * 100 : 0;
            return (
              <div key={ec.id} className="card p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Mail className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900">{ec.name}</h3>
                        <span className={`badge ${statusColors[ec.status]}`}>{ec.status}</span>
                      </div>
                      <p className="text-sm text-gray-500 mb-1">{ec.subject}</p>
                      {ec.campaign && <p className="text-xs text-amber-600">Campaign: {ec.campaign.name}</p>}
                      <p className="text-xs text-gray-400 mt-1">Created {formatDate(ec.createdAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href={`/email-campaigns/${ec.id}`} className="btn-secondary text-sm">View</Link>
                  </div>
                </div>

                <div className="grid grid-cols-5 gap-4 mt-4 pt-4 border-t border-gray-100">
                  {[
                    { label: "Queued", value: formatNumber(ec.totalQueued), icon: Clock },
                    { label: "Sent", value: formatNumber(ec.totalSent), icon: Mail },
                    { label: "Opened", value: formatPercent(openRate), icon: CheckCircle },
                    { label: "Replied", value: formatPercent(replyRate), icon: Play },
                    { label: "Bounced", value: formatNumber(ec.totalBounced), icon: X },
                  ].map((stat) => (
                    <div key={stat.label} className="text-center">
                      <p className="text-lg font-bold text-gray-900">{stat.value}</p>
                      <p className="text-xs text-gray-400">{stat.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { requireSession } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { ArrowLeft, Mail, Clock, CheckCircle, Play, X, User } from "lucide-react";
import { formatDate, formatNumber, formatPercent } from "@/lib/utils";
import { notFound } from "next/navigation";
import DeleteEmailCampaignButton from "../DeleteEmailCampaignButton";

export const dynamic = "force-dynamic";

export default async function EmailCampaignDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;

  const { data: ec, error } = await supabase
    .from("email_campaigns")
    .select(`
      *,
      campaign:campaigns(name),
      createdBy:users(name)
    `)
    .eq("id", id)
    .eq("organizationId", session.organizationId)
    .maybeSingle();

  if (error || !ec) return notFound();

  const openRate = ec.totalSent > 0 ? (ec.totalOpened / ec.totalSent) * 100 : 0;
  const replyRate = ec.totalSent > 0 ? (ec.totalReplied / ec.totalSent) * 100 : 0;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/email-campaigns" className="btn-ghost p-2">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{ec.name}</h1>
            <p className="text-gray-500 text-sm">Created on {formatDate(ec.createdAt)}</p>
          </div>
        </div>
        <DeleteEmailCampaignButton id={ec.id} variant="danger" redirectAfterDelete={true} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <div className="card p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Email Content</h2>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Subject Line</p>
                <p className="font-medium text-gray-900 bg-gray-50 p-3 rounded-lg">{ec.subject}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">HTML Content</p>
                <div 
                  className="bg-white border border-gray-200 p-4 rounded-lg min-h-[200px] prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: ec.htmlContent }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Overview</h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                <span className="text-sm text-gray-500">Status</span>
                <span className="badge badge-amber">{ec.status}</span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                <span className="text-sm text-gray-500">Target Campaign</span>
                <span className="text-sm font-medium text-gray-900">{ec.campaign?.name || "N/A"}</span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                <span className="text-sm text-gray-500 flex items-center gap-1.5"><User className="w-3.5 h-3.5"/> Creator</span>
                <span className="text-sm font-medium text-gray-900">{ec.createdBy?.name || "System"}</span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                <span className="text-sm text-gray-500 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5"/> Send Mode</span>
                <span className="text-sm font-medium text-gray-900">{ec.scheduledAt ? "Scheduled" : "Immediate"}</span>
              </div>
              {ec.scheduledAt && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5"/> Scheduled For</span>
                  <span className="text-sm font-medium text-gray-900">{formatDate(ec.scheduledAt)}</span>
                </div>
              )}
            </div>
          </div>

          <div className="card p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Performance</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-xs text-blue-600 font-medium mb-1 flex items-center gap-1"><Mail className="w-3 h-3"/> Sent</p>
                <p className="text-xl font-bold text-blue-900">{formatNumber(ec.totalSent)}</p>
              </div>
              <div className="bg-emerald-50 p-3 rounded-lg">
                <p className="text-xs text-emerald-600 font-medium mb-1 flex items-center gap-1"><CheckCircle className="w-3 h-3"/> Open Rate</p>
                <p className="text-xl font-bold text-emerald-900">{formatPercent(openRate)}</p>
              </div>
              <div className="bg-amber-50 p-3 rounded-lg">
                <p className="text-xs text-amber-600 font-medium mb-1 flex items-center gap-1"><Play className="w-3 h-3"/> Reply Rate</p>
                <p className="text-xl font-bold text-amber-900">{formatPercent(replyRate)}</p>
              </div>
              <div className="bg-red-50 p-3 rounded-lg">
                <p className="text-xs text-red-600 font-medium mb-1 flex items-center gap-1"><X className="w-3 h-3"/> Bounced</p>
                <p className="text-xl font-bold text-red-900">{formatNumber(ec.totalBounced)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

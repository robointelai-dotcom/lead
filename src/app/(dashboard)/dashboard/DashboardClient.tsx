"use client";

import Link from "next/link";
import {
  Target, Users, BookmarkCheck, Mail, BarChart3, TrendingUp,
  Megaphone, Search, Plus, FileText, Send, ArrowUpRight,
  Star
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from "recharts";
import type { SessionUser } from "@/lib/auth";
import { formatNumber, formatPercent } from "@/lib/utils";

interface DashboardData {
  stats: {
    totalCampaigns: number;
    activeCampaigns: number;
    totalLeads: number;
    newLeadsThisMonth: number;
    leadsWithEmail: number;
    leadsWithPhone: number;
    qualifiedLeads: number;
    wonLeads: number;
    emailsSent: number;
    avgOpenRate: number;
    conversionRate: number;
    remainingSearches: number;
    searchLimit: number;
  };
  recentCampaigns: Array<{
    id: string;
    name: string;
    status: string;
    niche: string | null;
    leadsCount: number;
    assignedUser: string | null;
  }>;
  recentLeads: Array<{
    id: string;
    businessName: string;
    category: string | null;
    city: string | null;
    email: string | null;
    phone: string | null;
    status: string;
    campaignName: string;
    qualityScore: number;
  }>;
  leadGrowthData: Array<{ month: string; leads: number }>;
}

const statusColors: Record<string, string> = {
  ACTIVE: "badge-green",
  DRAFT: "badge-gray",
  PAUSED: "badge-amber",
  ARCHIVED: "badge-gray",
  COMPLETED: "badge-blue",
};

const leadStatusColors: Record<string, string> = {
  NEW: "badge-blue",
  CONTACTED: "badge-amber",
  REPLIED: "badge-purple",
  QUALIFIED: "badge-green",
  PROPOSAL_SENT: "badge-indigo",
  WON: "badge-green",
  LOST: "badge-red",
  DO_NOT_CONTACT: "badge-red",
};

const quickActions = [
  { label: "Create Campaign", href: "/campaigns/new", icon: Plus, color: "bg-amber-500" },
  { label: "Search Leads", href: "/search", icon: Search, color: "bg-blue-500" },
  { label: "View Leads", href: "/leads", icon: Users, color: "bg-purple-500" },
  { label: "Send Email", href: "/email-campaigns/new", icon: Send, color: "bg-green-500" },
  { label: "View Reports", href: "/reports", icon: FileText, color: "bg-indigo-500" },
];

export default function DashboardClient({
  data,
  session,
}: {
  data: DashboardData & { error?: string };
  session: SessionUser;
}) {
  const { stats, error } = data;
  const rawUsagePercent = stats.searchLimit > 0
    ? ((stats.searchLimit - stats.remainingSearches) / stats.searchLimit) * 100
    : 0;
  const usagePercent = Math.min(100, Math.max(0, rawUsagePercent));

  const kpiCards = [
    {
      label: "Total Campaigns",
      value: formatNumber(stats.totalCampaigns),
      sub: `${stats.activeCampaigns} active`,
      icon: Megaphone,
      color: "bg-amber-50 text-amber-600",
      href: "/campaigns",
    },
    {
      label: "Total Saved Leads",
      value: formatNumber(stats.totalLeads),
      sub: `+${stats.newLeadsThisMonth} this month`,
      icon: BookmarkCheck,
      color: "bg-blue-50 text-blue-600",
      href: "/leads",
    },
    {
      label: "Leads with Email",
      value: formatNumber(stats.leadsWithEmail),
      sub: `${stats.totalLeads ? Math.round((stats.leadsWithEmail / stats.totalLeads) * 100) : 0}% of total`,
      icon: Mail,
      color: "bg-purple-50 text-purple-600",
      href: "/leads?filter=email",
    },
    {
      label: "Leads with Phone",
      value: formatNumber(stats.leadsWithPhone),
      sub: `${stats.totalLeads ? Math.round((stats.leadsWithPhone / stats.totalLeads) * 100) : 0}% of total`,
      icon: Users,
      color: "bg-green-50 text-green-600",
      href: "/leads?filter=phone",
    },
    {
      label: "Qualified Leads",
      value: formatNumber(stats.qualifiedLeads),
      sub: `${stats.wonLeads} won`,
      icon: Target,
      color: "bg-indigo-50 text-indigo-600",
      href: "/leads?status=QUALIFIED",
    },
    {
      label: "Emails Sent",
      value: formatNumber(stats.emailsSent),
      sub: `${formatPercent(stats.avgOpenRate)} open rate`,
      icon: Send,
      color: "bg-pink-50 text-pink-600",
      href: "/email-campaigns",
    },
    {
      label: "Conversion Rate",
      value: formatPercent(stats.conversionRate),
      sub: `${stats.wonLeads} won deals`,
      icon: TrendingUp,
      color: "bg-emerald-50 text-emerald-600",
      href: "/reports",
    },
    {
      label: "Monthly Usage",
      value: formatNumber(stats.remainingSearches),
      sub: `searches remaining`,
      icon: BarChart3,
      color: "bg-orange-50 text-orange-600",
      href: "/subscription",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2">
          <span className="text-red-500 font-bold">⚠</span>
          {error}
        </div>
      )}

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Good morning, {(session.name || "there").split(" ")[0]} 👋
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Here&apos;s what&apos;s happening with your campaigns today.
          </p>
        </div>
        <Link href="/campaigns/new" className="btn-primary">
          <Plus className="w-4 h-4" />
          New Campaign
        </Link>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpiCards.map((card) => (
          <Link key={card.label} href={card.href} className="stat-card hover:shadow-md transition-shadow group">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${card.color}`}>
                <card.icon className="w-4 h-4" />
              </div>
              <ArrowUpRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{card.value}</p>
            <p className="text-xs font-medium text-gray-500 mt-1">{card.label}</p>
            <p className="text-xs text-gray-400 mt-0.5">{card.sub}</p>
          </Link>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Lead Growth */}
        <div className="card p-5 col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-900">Lead Growth</h3>
              <p className="text-xs text-gray-500">Leads saved over last 6 months</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data.leadGrowthData}>
              <defs>
                <linearGradient id="leadGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }} />
              <Area type="monotone" dataKey="leads" stroke="#f59e0b" strokeWidth={2} fill="url(#leadGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Quick Actions */}
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="space-y-2">
            {quickActions.map((action) => (
              <Link
                key={action.label}
                href={action.href}
                className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors group"
              >
                <div className={`w-8 h-8 ${action.color} rounded-lg flex items-center justify-center`}>
                  <action.icon className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                  {action.label}
                </span>
                <ArrowUpRight className="w-3.5 h-3.5 text-gray-300 ml-auto" />
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Recent data */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Campaigns */}
        <div className="card">
          <div className="flex items-center justify-between p-5 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Recent Campaigns</h3>
            <Link href="/campaigns" className="text-amber-600 text-sm font-medium hover:text-amber-700">
              View all
            </Link>
          </div>
          {data.recentCampaigns.length === 0 ? (
            <div className="empty-state">
              <Megaphone className="w-10 h-10 mb-3 opacity-30" />
              <p className="font-medium">No campaigns yet</p>
              <Link href="/campaigns/new" className="btn-primary mt-3 text-xs">Create Campaign</Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {data.recentCampaigns.map((c) => (
                <Link key={c.id} href={`/campaigns/${c.id}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                  <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Megaphone className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{c.name}</p>
                    <p className="text-xs text-gray-400">{c.niche} · {c.leadsCount} leads</p>
                  </div>
                  <span className={`badge ${statusColors[c.status] || "badge-gray"}`}>{c.status}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent Leads */}
        <div className="card">
          <div className="flex items-center justify-between p-5 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Recent Leads</h3>
            <Link href="/leads" className="text-amber-600 text-sm font-medium hover:text-amber-700">
              View all
            </Link>
          </div>
          {data.recentLeads.length === 0 ? (
            <div className="empty-state">
              <BookmarkCheck className="w-10 h-10 mb-3 opacity-30" />
              <p className="font-medium">No saved leads yet</p>
              <Link href="/search" className="btn-primary mt-3 text-xs">Search Leads</Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {data.recentLeads.map((lead) => (
                <div key={lead.id} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{lead.businessName}</p>
                    <p className="text-xs text-gray-400">{lead.category} · {lead.city}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {lead.email && <div className="w-5 h-5 bg-blue-50 rounded flex items-center justify-center" title="Has email"><Mail className="w-3 h-3 text-blue-500" /></div>}
                    <div className="flex items-center gap-0.5">
                      <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                      <span className="text-xs text-gray-500">{lead.qualityScore}</span>
                    </div>
                    <span className={`badge ${leadStatusColors[lead.status] || "badge-gray"} text-xs`}>
                      {lead.status.replace("_", " ")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Usage bar */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold text-gray-900">Monthly Search Usage</h3>
            <p className="text-xs text-gray-500">
              {formatNumber(stats.searchLimit - stats.remainingSearches)} of {formatNumber(stats.searchLimit)} searches used
            </p>
          </div>
          <Link href="/subscription" className="btn-secondary text-xs">Upgrade Plan</Link>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${usagePercent}%` }} />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-xs text-gray-400">{Math.round(usagePercent)}% used</span>
          <span className="text-xs text-gray-400">{formatNumber(stats.remainingSearches)} remaining</span>
        </div>
      </div>
    </div>
  );
}

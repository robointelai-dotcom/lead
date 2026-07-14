import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { BarChart3, Plus, FileText, Download } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import ReportsClient from "./ReportsClient";

export const metadata = { title: "Reports" };

export default async function ReportsPage() {
  const session = await requireSession();

  const [reports, campaigns] = await Promise.all([
    prisma.report.findMany({
      where: { organizationId: session.organizationId },
      orderBy: { createdAt: "desc" },
      include: { campaign: { select: { name: true } }, createdBy: { select: { name: true } } },
      take: 10,
    }),
    prisma.campaign.findMany({
      where: { organizationId: session.organizationId },
      select: { id: true, name: true, status: true, _count: { select: { leads: true } } },
      orderBy: { name: "asc" },
    }),
  ]);

  // Campaign performance data for chart
  const campaignData = campaigns.slice(0, 8).map((c) => ({
    name: c.name.length > 15 ? c.name.slice(0, 15) + "…" : c.name,
    leads: c._count.leads,
    status: c.status,
  }));

  return <ReportsClient reports={reports.map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type,
    campaignName: r.campaign?.name || null,
    createdByName: r.createdBy?.name || null,
    generatedAt: r.generatedAt?.toISOString() || null,
    createdAt: r.createdAt.toISOString(),
  }))} campaigns={campaigns.map((c) => ({ id: c.id, name: c.name }))} campaignData={campaignData} />;
}

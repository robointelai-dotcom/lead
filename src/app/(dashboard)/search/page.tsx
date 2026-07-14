import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import SearchLeadsClient from "./SearchLeadsClient";

export const metadata = { title: "Search Leads" };

export default async function SearchLeadsPage() {
  const session = await requireSession();

  const campaigns = await prisma.campaign.findMany({
    where: { organizationId: session.organizationId, status: { in: ["ACTIVE", "DRAFT"] } },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return <SearchLeadsClient campaigns={campaigns} />;
}

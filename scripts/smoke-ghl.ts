import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { encryptToken } from "../src/lib/crypto";
import { syncLeadToGhl, enqueueGhlSync } from "../src/lib/workers/ghlSyncer";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const org = await prisma.organization.findFirst();
  if (!org) throw new Error("no org");

  // 1) Store a GHL integration with MOCK_TOKEN so the syncer takes the mock path
  const existing = await prisma.integration.findFirst({
    where: { organizationId: org.id, provider: "ghl" },
  });
  const data = {
    organizationId: org.id,
    provider: "ghl",
    type: "CRM" as const,
    name: "GoHighLevel CRM",
    isActive: true,
    ghlAccessToken: encryptToken("MOCK_TOKEN"),
    ghlLocationId: "lctn_demo_12345",
  };
  if (existing) {
    await prisma.integration.update({ where: { id: existing.id }, data });
    console.log("Updated GHL integration:", existing.id);
  } else {
    const created = await prisma.integration.create({ data });
    console.log("Created GHL integration:", created.id);
  }

  // 2) Pick an eligible campaign_lead
  const cl = await prisma.campaignLead.findFirst({
    where: {
      campaign: { organizationId: org.id },
      status: { not: "QUALIFIED" },
    },
    include: { lead: true },
  });
  if (!cl) {
    console.log("(no eligible campaign_lead — trying any lead)");
    const anyLead = await prisma.lead.findFirst({ where: { organizationId: org.id } });
    if (!anyLead) throw new Error("no leads");
    const direct = await syncLeadToGhl(org.id, anyLead.id);
    console.log("[direct syncLeadToGhl] result:", direct);
  } else {
    console.log("Using CampaignLead:", cl.id, "lead:", cl.lead.businessName);
    const direct = await syncLeadToGhl(org.id, cl.leadId, cl.id);
    console.log("[direct syncLeadToGhl] result:", direct);

    const jobId = await enqueueGhlSync({
      organizationId: org.id,
      leadId: cl.leadId,
      campaignLeadId: cl.id,
      reason: "smoke-test-manual",
    });
    console.log("[enqueueGhlSync] jobId:", jobId);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

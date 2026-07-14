import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getSearchQueue } from "../src/lib/queue";

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  const org = await prisma.organization.findFirst({ select: { id: true } });
  if (!org) throw new Error("No org");

  const job = await prisma.searchJob.create({
    data: {
      organizationId: org.id,
      niche: "Dentist",
      country: "US",
      state: "CA",
      city: "Los Angeles",
      maxResults: 5,
      status: "PENDING",
    },
  });

  console.log("[test] created SearchJob:", job.id);

  const queue = getSearchQueue();
  await queue.add(
    "search",
    {
      searchJobId: job.id,
      organizationId: org.id,
      niche: "Dentist",
      country: "US",
      state: "CA",
      city: "Los Angeles",
      maxResults: 5,
      autoFindEmails: false,
      autoDispatchToGithub: true,
    },
    { jobId: job.id }
  );

  console.log("[test] enqueued job, waiting for worker…");

  // Poll for completion
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const j = await prisma.searchJob.findUnique({ where: { id: job.id } });
    console.log(
      `[test] status=${j?.status} processed=${j?.totalProcessed} found=${j?.totalFound}`
    );
    if (j?.status === "COMPLETED" || j?.status === "FAILED") {
      console.log(
        "[test] Final:",
        JSON.stringify(
          {
            status: j.status,
            totalFound: j.totalFound,
            totalWithEmail: j.totalWithEmail,
            totalWithPhone: j.totalWithPhone,
            errorMessage: j.errorMessage,
          },
          null,
          2
        )
      );
      break;
    }
  }

  await prisma.$disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

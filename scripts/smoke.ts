import "dotenv/config";
import { encryptToken, decryptToken, isEncrypted } from "../src/lib/crypto";
import { dispatchGithubRepositoryEvent } from "../src/lib/workers/githubDispatcher";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

async function main() {
  // --- Crypto ---
  const plain = "ghp_supersecretGitHubToken_1234567890";
  const cipher = encryptToken(plain);
  const back = decryptToken(cipher);
  console.log("[crypto] plain=", plain);
  console.log("[crypto] cipher=", cipher.slice(0, 50) + "...");
  console.log("[crypto] roundtrip ok?", plain === back);
  console.log("[crypto] isEncrypted(cipher)=", isEncrypted(cipher));
  console.log("[crypto] isEncrypted(plain)=", isEncrypted(plain));

  // --- Dispatch (should MOCK because GITHUB_TOKEN=MOCK_TOKEN) ---
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });
  const org = await prisma.organization.findFirst({ select: { id: true, name: true } });
  await prisma.$disconnect();
  if (!org) throw new Error("No org");

  const result = await dispatchGithubRepositoryEvent({
    organizationId: org.id,
    leads: [
      { id: "l1", businessName: "Smile Dental", email: "hi@smiledental.com" },
      { id: "l2", businessName: "Bright Ortho", email: "hi@brightortho.com" },
    ],
    searchJobId: "test-job-1",
  });
  console.log("[dispatch] result=", result);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

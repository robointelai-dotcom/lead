import { prisma } from './src/lib/prisma';
import { askGeminiForEmail } from './src/lib/discover-email';

async function run() {
  const gemini = await prisma.integration.findFirst({ where: { provider: "gemini", isActive: true } });
  const apiKey = (gemini?.credentials as any)?.apiKey;

  console.log("=== Test 1: All In One Dental ===");
  const email1 = await askGeminiForEmail(
    apiKey,
    "All In One Dental",
    "http://westchesterfamilydentists.com/",
    "(310) 645-6033",
    "8930 S Sepulveda Blvd #118, Los Angeles, CA 90045, USA"
  );
  console.log("Result:", email1 ?? "NOT FOUND");

  console.log("\n=== Test 2: DTLA Smile ===");
  const email2 = await askGeminiForEmail(
    apiKey,
    "DTLA Smile",
    "",
    "(213) 688-2828",
    "104 W 7th St #2, Los Angeles, CA 90014, USA"
  );
  console.log("Result:", email2 ?? "NOT FOUND");
}
run().catch(console.error).finally(() => prisma.$disconnect());

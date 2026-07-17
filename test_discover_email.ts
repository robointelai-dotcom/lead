import { discoverEmail } from "./src/lib/ai/discover-email";
import { prisma } from "./src/lib/prisma";

async function main() {
  const org = await prisma.organization.findFirst();
  
  if (!org) {
    console.error("No organization found");
    process.exit(1);
  }

  console.log("Testing with Organization:", org.id);

  console.log("--- TEST DISCOVER EMAIL ---");
  const result = await discoverEmail(
    org.id,
    "Sky Dental",
    "https://skydental.com",
    "(212) 555-1234"
  );

  console.log("Result:", JSON.stringify(result, null, 2));
}

main().catch(console.error);

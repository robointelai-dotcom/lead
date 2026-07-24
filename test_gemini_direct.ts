import { askGeminiForEmail } from './src/lib/discover-email';
import { prisma } from './src/lib/prisma';

async function run() {
  const integration = await prisma.integration.findFirst({
    where: { provider: "gemini", isActive: true }
  });
  const apiKey = (integration?.credentials as any)?.apiKey;
  if (!apiKey) {
    console.error("No API key");
    return;
  }
  
  const email = await askGeminiForEmail(apiKey, "Service Plus Plumbing", "https://www.serviceplusplumbingpdx.com/", "(503) 927-4482");
  console.log("Found email:", email);
}
run().catch(console.error).finally(() => prisma.$disconnect());

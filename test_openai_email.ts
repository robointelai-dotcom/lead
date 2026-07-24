import { prisma } from './src/lib/prisma';
import { askOpenAIForEmail } from './src/lib/discover-email';

async function run() {
  const integration = await prisma.integration.findFirst({ where: { provider: "openai", isActive: true } });
  const apiKey = (integration?.credentials as any)?.apiKey;
  console.log("OpenAI key found:", !!apiKey, "prefix:", apiKey?.slice(0,15));
  
  const email = await askOpenAIForEmail(
    apiKey,
    "NEW YORK BUSINESS CONSULTING CO",
    "",
    "(718) 445-5050",
    "194-02 Northern Blvd SUITE212, Flushing, NY 11358, USA"
  );
  console.log("Found email:", email);
}
run().catch(console.error).finally(() => prisma.$disconnect());

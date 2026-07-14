import { prisma } from './src/lib/prisma';
import { askGeminiForEmail } from './src/lib/lead-provider';

async function run() {
  const integration = await prisma.integration.findFirst({
    where: { provider: "gemini", isActive: true }
  });
  const apiKey = (integration?.credentials as any)?.apiKey;
  
  const email = await askGeminiForEmail(
    apiKey, 
    "Business With The USA", 
    "", 
    "(786) 876-9555"
  );
  console.log("Found email:", email);
}
run().catch(console.error).finally(() => prisma.$disconnect());

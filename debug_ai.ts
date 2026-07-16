import { prisma } from './src/lib/prisma'
import { decryptToken } from './src/lib/crypto'
import { askGeminiForEmail, askOpenAIForEmail } from './src/lib/lead-provider'

async function test() {
  const org = await prisma.organization.findFirst({ where: { slug: 'acme-agency' }});
  const integrations = await prisma.integration.findMany({ where: { organizationId: org!.id }});
  const gInt = integrations.find(i => i.provider === 'gemini');
  const oInt = integrations.find(i => i.provider === 'openai');
  const gKey = gInt ? decryptToken((gInt.credentials as any).apiKey) : null;
  const oKey = oInt ? decryptToken((oInt.credentials as any).apiKey) : null;
  
  const bizName = "Sky Dental";
  const bizWebsite = "https://skydentalnyc.com/";
  const bizPhone = "(212) 600-1996";

  console.log("=== GEMINI TEST ===");
  if (gKey) {
    try {
      const email = await askGeminiForEmail(gKey, bizName, bizWebsite, bizPhone, "");
      console.log("Gemini SUCCESS:", email);
    } catch (e: any) {
      console.error("Gemini ERROR:", e.message);
    }
  } else console.log("No Gemini key");

  console.log("\n=== OPENAI TEST ===");
  if (oKey) {
    try {
      const email = await askOpenAIForEmail(oKey, bizName, bizWebsite, bizPhone, "");
      console.log("OpenAI SUCCESS:", email);
    } catch (e: any) {
      console.error("OpenAI ERROR:", e.message);
    }
  } else console.log("No OpenAI key");
}

test().catch(console.error).finally(() => prisma.$disconnect());

import { prisma } from './src/lib/prisma'
import { decryptToken } from './src/lib/crypto'
import { askGeminiForEmail } from './src/lib/lead-provider'

async function test() {
  const org = await prisma.organization.findFirst({ where: { slug: 'acme-agency' }});
  const integrations = await prisma.integration.findMany({ where: { organizationId: org!.id }});
  const gInt = integrations.find(i => i.provider === 'gemini');
  const gKey = gInt ? decryptToken((gInt.credentials as any).apiKey) : null;
  
  if (gKey) {
    try {
      const email = await askGeminiForEmail(gKey, "Sky Dental", "https://skydentalnyc.com/", "(212) 600-1996", "");
      console.log("SUCCESS, found email:", email);
    } catch (e: any) {
      console.log("FAILED with error:", e.message);
    }
  }
}
test().catch(console.error).finally(() => prisma.$disconnect());

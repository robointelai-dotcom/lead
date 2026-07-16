import { prisma } from './src/lib/prisma'
import { decryptToken } from './src/lib/crypto'

async function test() {
  const org = await prisma.organization.findFirst({ where: { slug: 'acme-agency' }});
  const integrations = await prisma.integration.findMany({ where: { organizationId: org!.id }});
  const oInt = integrations.find(i => i.provider === 'openai');
  const oKey = oInt ? decryptToken((oInt.credentials as any).apiKey) : null;
  
  if (oKey) {
    console.log("Current OpenAI Key starts with:", oKey.substring(0, 15) + "...");
    console.log("Current OpenAI Key ends with:", "..." + oKey.substring(oKey.length - 10));
    console.log("Length:", oKey.length);
  } else {
    console.log("No OpenAI key found.");
  }
}
test().catch(console.error).finally(() => prisma.$disconnect());

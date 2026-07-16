import { prisma } from './src/lib/prisma'
import { decryptToken } from './src/lib/crypto'

async function test() {
  const org = await prisma.organization.findFirst({ where: { slug: 'acme-agency' }});
  const integrations = await prisma.integration.findMany({ where: { organizationId: org!.id }});
  const oInt = integrations.find(i => i.provider === 'openai');
  const oKey = oInt ? decryptToken((oInt.credentials as any).apiKey) : null;
  
  if (oKey) {
    console.log("Key length:", oKey.length);
    console.log("Trimmed length:", oKey.trim().length);
    console.log("Ends with space?", oKey.endsWith(' '));
    console.log("Ends with newline?", oKey.endsWith('\n'));
  }
}
test().catch(console.error).finally(() => prisma.$disconnect());

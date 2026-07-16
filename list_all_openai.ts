import { prisma } from './src/lib/prisma'
import { decryptToken } from './src/lib/crypto'

async function test() {
  const integrations = await prisma.integration.findMany({ where: { provider: 'openai' } });
  console.log(`Found ${integrations.length} OpenAI integrations.`);
  for (const i of integrations) {
    const key = i.credentials ? decryptToken((i.credentials as any).apiKey) : "null";
    console.log(`Org ID: ${i.organizationId}, Key ends with: ${key.substring(key.length - 10)}`);
  }
}
test().catch(console.error).finally(() => prisma.$disconnect());

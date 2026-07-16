import { prisma } from './src/lib/prisma'
import { decryptToken } from './src/lib/crypto'

async function test() {
  const integrations = await prisma.integration.findMany();
  console.log(`Found ${integrations.length} integrations in the database.`);
  
  for (const i of integrations) {
    const key = i.credentials ? decryptToken((i.credentials as any).apiKey) : "null";
    console.log(`Org ID: ${i.organizationId} | Provider: ${i.provider} | Key ends with: ${key.substring(key.length - 10)}`);
  }
}
test().catch(console.error).finally(() => prisma.$disconnect());

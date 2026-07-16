import { prisma } from './src/lib/prisma'
import { decryptToken } from './src/lib/crypto'

async function test() {
  const integrations = await prisma.integration.findMany();
  const gInt = integrations.find(i => i.provider === 'gemini');
  const gKey = gInt?.credentials ? decryptToken((gInt.credentials as any).apiKey) : null;
  
  if (gKey) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${gKey}`);
    const data = await response.json();
    console.log("Models available:", data.models?.map((m: any) => m.name).join(", "));
  }
}
test().catch(console.error).finally(() => prisma.$disconnect());

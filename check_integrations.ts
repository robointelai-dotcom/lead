import { prisma } from './src/lib/prisma';
async function run() {
  const integrations = await prisma.integration.findMany({ where: { isActive: true } });
  for (const i of integrations) {
    const creds = i.credentials as any;
    console.log(`provider=${i.provider} isActive=${i.isActive} hasKey=${!!(creds?.apiKey)} keyPrefix=${creds?.apiKey?.slice(0,12)}`);
  }
}
run().catch(console.error).finally(() => prisma.$disconnect());

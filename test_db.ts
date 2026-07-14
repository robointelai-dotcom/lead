import { prisma } from './src/lib/prisma';
async function test() {
  const integrations = await prisma.integration.findMany();
  console.log(integrations);
}
test().catch(console.error).finally(() => prisma.$disconnect());

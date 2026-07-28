const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const ints = await prisma.integration.findMany();
  console.log(ints);
}
main().catch(console.error).finally(() => prisma.$disconnect());

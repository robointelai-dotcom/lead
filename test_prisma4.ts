import { PrismaClient } from "@prisma/client";
async function run() {
  const p = new PrismaClient({
    datasourceUrl: "postgresql://foo:bar@localhost:1234/test"
  });
  try {
    await p.integration.findFirst({ where: { organizationId: "123", provider: "gmass" } });
  } catch (err: any) {
    console.log("MESSAGE:", err.message);
  }
}
run();

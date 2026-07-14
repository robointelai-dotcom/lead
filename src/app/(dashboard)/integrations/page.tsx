import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import IntegrationsClient from "./IntegrationsClient";

export const metadata = { title: "Integrations" };

export default async function IntegrationsPage() {
  const session = await requireSession();

  const integrations = await prisma.integration.findMany({
    where: { organizationId: session.organizationId },
    select: { provider: true, isActive: true },
  });

  return <IntegrationsClient existingIntegrations={integrations} />;
}

import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import IntegrationsClient from "./IntegrationsClient";

export const metadata = { title: "Integrations" };

export default async function IntegrationsPage() {
  const session = await requireSession();

  let integrations: any[] = [];
  try {
    integrations = await prisma.integration.findMany({
      where: {
        organizationId: session.organizationId,
      },
      select: {
        provider: true,
        isActive: true,
        credentials: true,
      },
    });
  } catch (err) {
    console.error("[integrations] Failed to fetch integrations:", err);
  }

  return <IntegrationsClient existingIntegrations={integrations || []} />;
}

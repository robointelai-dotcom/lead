"use server";

import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function saveIntegrationAction(
  type: "LEAD_PROVIDER" | "EMAIL_PROVIDER",
  name: string,
  provider: string,
  apiKey: string,
  isActive: boolean
) {
  const session = await requireSession();

  try {
    const existing = await prisma.integration.findFirst({
      where: { organizationId: session.organizationId, provider },
    });

    if (existing) {
      await prisma.integration.update({
        where: { id: existing.id },
        data: {
          credentials: apiKey ? { apiKey } : (existing.credentials || {}),
          isActive,
        },
      });
    } else {
      await prisma.integration.create({
        data: {
          organizationId: session.organizationId,
          type,
          name,
          provider,
          credentials: apiKey ? { apiKey } : {},
          isActive,
        },
      });
    }

    revalidatePath("/integrations");
    return { success: true };
  } catch (err) {
    console.error(err);
    return { success: false, error: "Failed to save integration" };
  }
}

export async function disconnectIntegrationAction(provider: string) {
  const session = await requireSession();

  try {
    const existing = await prisma.integration.findFirst({
      where: { organizationId: session.organizationId, provider },
    });

    if (existing) {
      await prisma.integration.update({
        where: { id: existing.id },
        data: { isActive: false },
      });
    }

    revalidatePath("/integrations");
    return { success: true };
  } catch (err) {
    console.error(err);
    return { success: false, error: "Failed to disconnect integration" };
  }
}

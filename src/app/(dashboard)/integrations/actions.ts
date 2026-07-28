"use server";

import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encryptToken } from "@/lib/crypto";
import { revalidatePath } from "next/cache";

export async function saveIntegrationAction(
  type: "LEAD_PROVIDER" | "EMAIL_PROVIDER" | "CRM" | "WEBHOOK",
  name: string,
  provider: string,
  apiKey: string,
  isActive: boolean
) {
  const session = await requireSession();

  try {
    const encryptedApiKey = apiKey ? encryptToken(apiKey) : "";

    const existing = await prisma.integration.findFirst({
      where: {
        organizationId: session.organizationId,
        provider,
      },
      select: { id: true, credentials: true },
    });

    if (existing) {
      await prisma.integration.update({
        where: { id: existing.id },
        data: {
          credentials: encryptedApiKey
            ? { apiKey: encryptedApiKey }
            : (existing.credentials as object | null) || {},
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
          credentials: encryptedApiKey ? { apiKey: encryptedApiKey } : {},
          isActive,
        },
      });
    }

    revalidatePath("/integrations");
    return { success: true };
  } catch (err) {
    console.error("[integrations] saveIntegrationAction failed:", err);
    return { success: false, error: "Failed to save integration" };
  }
}

export async function disconnectIntegrationAction(provider: string) {
  const session = await requireSession();

  try {
    const existing = await prisma.integration.findFirst({
      where: {
        organizationId: session.organizationId,
        provider,
      },
      select: { id: true },
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
    console.error("[integrations] disconnectIntegrationAction failed:", err);
    return { success: false, error: "Failed to disconnect integration" };
  }
}

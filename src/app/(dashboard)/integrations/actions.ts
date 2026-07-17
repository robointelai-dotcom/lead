"use server";

import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encryptToken } from "@/lib/crypto";
import { revalidatePath } from "next/cache";

function normalizeSecret(value: string): string {
  return value
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/^Bearer\s+/i, "")
    .trim();
}

/**
 * Save (or update) an integration for the current organization.
 * Encrypts the API key at rest so we never persist plaintext secrets.
 */
export async function saveIntegrationAction(
  type: "LEAD_PROVIDER" | "EMAIL_PROVIDER",
  name: string,
  provider: string,
  apiKey: string,
  isActive: boolean
) {
  const session = await requireSession();

  try {
    const normalizedApiKey = apiKey ? normalizeSecret(apiKey) : "";
    const encryptedApiKey = normalizedApiKey ? encryptToken(normalizedApiKey) : "";

    const existing = await prisma.integration.findFirst({
      where: { organizationId: session.organizationId, provider },
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

/**
 * Deactivate an integration for the current org.
 */
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
    console.error("[integrations] disconnectIntegrationAction failed:", err);
    return { success: false, error: "Failed to disconnect integration" };
  }
}

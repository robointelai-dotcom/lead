"use server";

import { requireSession } from "@/lib/auth";
import { saveIntegration, disconnectIntegration } from "@/lib/services/integration-service";
import { revalidatePath } from "next/cache";

export async function saveIntegrationAction(
  type: import("@prisma/client").IntegrationType,
  name: string,
  provider: string,
  apiKey: string,
  isActive: boolean
) {
  const session = await requireSession();

  try {
    await saveIntegration({
      organizationId: session.organizationId,
      type,
      name,
      provider,
      apiKey,
      isActive,
    });

    revalidatePath("/integrations");
    return { success: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[integrations] saveIntegrationAction failed:", errorMsg);
    return { success: false, error: "Failed to save integration" };
  }
}

export async function disconnectIntegrationAction(provider: string) {
  const session = await requireSession();

  try {
    await disconnectIntegration(session.organizationId, provider);
    revalidatePath("/integrations");
    return { success: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[integrations] disconnectIntegrationAction failed:", errorMsg);
    return { success: false, error: "Failed to disconnect integration" };
  }
}

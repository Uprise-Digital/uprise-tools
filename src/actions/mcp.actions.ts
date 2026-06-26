// actions/mcp.actions.ts
"use server";

import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db"; // Adjust path to your db instance
import { mcpSettings } from "@/db/schema";

// Mock auth fetcher - replace with your actual session/auth logic
const getAgencyId = async () => 1;

/**
 * Helper: Generate a secure, recognizable API key
 */
const generateApiKey = () => `agv_live_${randomBytes(24).toString("hex")}`;

/**
 * Fetch or initialize the MCP settings for the current agency
 */
export async function getMcpSettingsAction() {
  const agencyId = await getAgencyId();

  let settings = await db.query.mcpSettings.findFirst({
    where: eq(mcpSettings.agencyId, agencyId),
  });

  // If no settings exist yet, create the default profile
  if (!settings) {
    const [newSettings] = await db
      .insert(mcpSettings)
      .values({
        agencyId,
        apiKey: generateApiKey(),
        toolsConfig: { godView: true, campaignDiagnostics: true },
      })
      .returning();
    settings = newSettings;
  }

  return { success: true, data: settings };
}

/**
 * Generate and save a new API Key, revoking the old one
 */
export async function rollMcpApiKeyAction() {
  try {
    const agencyId = await getAgencyId();
    const newKey = generateApiKey();

    const [updated] = await db
      .update(mcpSettings)
      .set({ apiKey: newKey, updatedAt: new Date() })
      .where(eq(mcpSettings.agencyId, agencyId))
      .returning();

    return { success: true, apiKey: updated.apiKey };
  } catch (error) {
    console.error("Failed to roll key:", error);
    return { success: false, error: "Failed to roll API key" };
  }
}

/**
 * Save the state of the tool toggles
 */
export async function updateMcpToolsAction(
  toolsConfig: Record<string, boolean>,
) {
  try {
    const agencyId = await getAgencyId();

    await db
      .update(mcpSettings)
      .set({ toolsConfig, updatedAt: new Date() })
      .where(eq(mcpSettings.agencyId, agencyId));

    return { success: true };
  } catch (error) {
    console.error("Failed to update tools:", error);
    return { success: false, error: "Failed to update tool permissions" };
  }
}

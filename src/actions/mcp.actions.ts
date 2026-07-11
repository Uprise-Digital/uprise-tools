// actions/mcp.actions.ts
"use server";

import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import { mcpSettings, member } from "@/db/schema";
import { logAction } from "@/lib/audit";
import { auth } from "@/lib/auth";

/**
 * Helper: Resolve active organization ID from session
 */
async function getActiveOrgId() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    throw new Error("Unauthorized");
  }

  let orgId = session.session.activeOrganizationId;
  if (!orgId) {
    const userMember = await db.query.member.findFirst({
      where: eq(member.userId, session.user.id),
    });
    if (userMember) {
      orgId = userMember.organizationId;
    }
  }

  if (!orgId) {
    throw new Error("No active organization found");
  }

  return { orgId, userId: session.user.id };
}

/**
 * Helper: Generate a secure, recognizable API key
 */
const generateApiKey = () => `agv_live_${randomBytes(24).toString("hex")}`;

/**
 * Fetch or initialize the MCP settings for the current organization
 */
export async function getMcpSettingsAction() {
  const { orgId } = await getActiveOrgId();

  let settings = await db.query.mcpSettings.findFirst({
    where: eq(mcpSettings.organizationId, orgId),
  });

  // If no settings exist yet, create the default profile
  if (!settings) {
    const [newSettings] = await db
      .insert(mcpSettings)
      .values({
        organizationId: orgId,
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
  const { orgId, userId } = await getActiveOrgId();

  try {
    const newKey = generateApiKey();

    const [updated] = await db
      .update(mcpSettings)
      .set({ apiKey: newKey, updatedAt: new Date() })
      .where(eq(mcpSettings.organizationId, orgId))
      .returning();

    // Log the roll key security event
    await logAction(userId, "ROLL_MCP_API_KEY", "mcp_settings", orgId, {
      organizationId: orgId,
      action: "rolled_apiKey",
    });

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
  const { orgId, userId } = await getActiveOrgId();

  try {
    await db
      .update(mcpSettings)
      .set({ toolsConfig, updatedAt: new Date() })
      .where(eq(mcpSettings.organizationId, orgId));

    // Log the tool updates event
    await logAction(
      userId,
      "UPDATE_MCP_TOOLS",
      "mcp_settings",
      orgId,
      toolsConfig,
    );

    return { success: true };
  } catch (error) {
    console.error("Failed to update tools:", error);
    return { success: false, error: "Failed to update tool permissions" };
  }
}

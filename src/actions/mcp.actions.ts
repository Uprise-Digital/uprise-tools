// actions/mcp.actions.ts
"use server";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import { mcpKeys, mcpSettings, mcpUsageLogs, member, user } from "@/db/schema";
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

  return { orgId, userId: session.user.id, userEmail: session.user.email };
}

/**
 * Helper: Generate a secure, recognizable API key
 */
const generateRawApiKey = () => `agv_live_${randomBytes(24).toString("hex")}`;
const hashApiKey = (key: string) =>
  createHash("sha256").update(key).digest("hex");

/**
 * Fetch or initialize the legacy MCP settings for the current organization
 */
export async function getMcpSettingsAction() {
  const { orgId } = await getActiveOrgId();

  let settings = await db.query.mcpSettings.findFirst({
    where: eq(mcpSettings.organizationId, orgId),
  });

  if (!settings) {
    const [newSettings] = await db
      .insert(mcpSettings)
      .values({
        organizationId: orgId,
        apiKey: generateRawApiKey(),
        toolsConfig: { godView: true, campaignDiagnostics: true },
      })
      .returning();
    settings = newSettings;
  }

  return { success: true, data: settings };
}

/**
 * Generate and save a new per-user MCP API Key
 */
export async function createMcpKeyAction(payload: {
  name: string;
  scopes?: string[];
  expiresAt?: string;
}) {
  const { orgId, userId } = await getActiveOrgId();

  try {
    const rawKey = generateRawApiKey();
    const keyHash = hashApiKey(rawKey);
    const keyPrefix = `${rawKey.slice(0, 14)}...`;
    const keyId = randomUUID();

    const grantedScopes =
      payload.scopes && payload.scopes.length > 0
        ? payload.scopes
        : ["read:analytics", "run:audits", "write:negatives"];

    const [insertedKey] = await db
      .insert(mcpKeys)
      .values({
        id: keyId,
        organizationId: orgId,
        userId: userId,
        name: payload.name.trim() || "Default MCP Key",
        keyHash: keyHash,
        keyPrefix: keyPrefix,
        scopes: grantedScopes,
        expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    await logAction(userId, "CREATE_MCP_KEY", "mcp_keys", keyId, {
      name: payload.name,
      prefix: keyPrefix,
      scopes: grantedScopes,
    });

    return {
      success: true,
      rawKey,
      key: insertedKey,
    };
  } catch (error: any) {
    console.error("createMcpKeyAction error:", error);
    return {
      success: false,
      error: error.message || "Failed to generate new MCP key",
    };
  }
}

/**
 * List all active MCP API keys for the current organization
 */
export async function listMcpKeysAction() {
  try {
    const { orgId } = await getActiveOrgId();

    const keysList = await db.query.mcpKeys.findMany({
      where: eq(mcpKeys.organizationId, orgId),
      orderBy: [desc(mcpKeys.createdAt)],
    });

    // Populate user owner names
    const usersList = await db.select().from(user);
    const userMap = new Map(usersList.map((u) => [u.id, u]));

    const enrichedKeys = keysList.map((k) => {
      const owner = userMap.get(k.userId);
      return {
        ...k,
        ownerName: owner?.name || "Unknown Member",
        ownerEmail: owner?.email || "",
      };
    });

    return { success: true, keys: enrichedKeys };
  } catch (error: any) {
    console.error("listMcpKeysAction error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Revoke/Delete a specific MCP API Key by ID
 */
export async function revokeMcpKeyAction(keyId: string) {
  try {
    const { orgId, userId } = await getActiveOrgId();

    await db.delete(mcpKeys).where(eq(mcpKeys.id, keyId));

    await logAction(userId, "REVOKE_MCP_KEY", "mcp_keys", keyId, {
      keyId,
    });

    return { success: true };
  } catch (error: any) {
    console.error("revokeMcpKeyAction error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Fetch MCP execution logs for the organization
 */
export async function getMcpUsageLogsAction(limit: number = 50) {
  try {
    const { orgId } = await getActiveOrgId();

    const logs = await db.query.mcpUsageLogs.findMany({
      where: eq(mcpUsageLogs.organizationId, orgId),
      orderBy: [desc(mcpUsageLogs.createdAt)],
      limit: Math.min(limit, 100),
    });

    return { success: true, logs };
  } catch (error: any) {
    console.error("getMcpUsageLogsAction error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Legacy API Key Roll (for fallback backward compatibility)
 */
export async function rollMcpApiKeyAction() {
  const { orgId, userId } = await getActiveOrgId();

  try {
    const newKey = generateRawApiKey();

    const [updated] = await db
      .update(mcpSettings)
      .set({ apiKey: newKey, updatedAt: new Date() })
      .where(eq(mcpSettings.organizationId, orgId))
      .returning();

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
 * Save tool toggles
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

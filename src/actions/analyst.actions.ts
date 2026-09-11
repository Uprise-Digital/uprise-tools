"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { withBypassTenantDb } from "@/db/db-helper";
import { adAccounts, analystConversations, analystMessages } from "@/db/schema";
import { runAnalystConversationTurn } from "@/lib/ai-service";
import { getAuthOrgContext } from "@/lib/auth-helpers";

export async function listAnalystConversationsAction() {
  const authContext = await getAuthOrgContext();
  if (!authContext) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const conversations = await withBypassTenantDb(async (tx) => {
      return await tx.query.analystConversations.findMany({
        where: and(
          eq(analystConversations.organizationId, authContext.orgId),
          eq(analystConversations.userId, authContext.userId),
        ),
        orderBy: [desc(analystConversations.updatedAt)],
        with: {
          adAccount: {
            columns: {
              id: true,
              name: true,
              googleAccountId: true,
            },
          },
        },
      });
    });

    return { success: true, data: conversations };
  } catch (error: any) {
    console.error("[listAnalystConversationsAction] Error:", error);
    return {
      success: false,
      error: error.message || "Failed to load conversations",
    };
  }
}

export async function createAnalystConversationAction(
  title: string = "New Analysis",
  adAccountId?: number | null,
) {
  const authContext = await getAuthOrgContext();
  if (!authContext) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const id =
      "conv_" +
      Math.random().toString(36).substring(2, 11) +
      Date.now().toString(36);

    const [created] = await withBypassTenantDb(async (tx) => {
      return await tx
        .insert(analystConversations)
        .values({
          id,
          organizationId: authContext.orgId,
          userId: authContext.userId,
          title: title.trim() || "New Analysis",
          adAccountId: adAccountId || null,
        })
        .returning();
    });

    revalidatePath("/analyst");
    return { success: true, data: created };
  } catch (error: any) {
    console.error("[createAnalystConversationAction] Error:", error);
    return {
      success: false,
      error: error.message || "Failed to create conversation",
    };
  }
}

export async function getAnalystConversationMessagesAction(
  conversationId: string,
) {
  const authContext = await getAuthOrgContext();
  if (!authContext) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const conv = await withBypassTenantDb(async (tx) => {
      return await tx.query.analystConversations.findFirst({
        where: and(
          eq(analystConversations.id, conversationId),
          eq(analystConversations.organizationId, authContext.orgId),
        ),
      });
    });

    if (!conv) {
      return { success: false, error: "Conversation not found" };
    }

    const messages = await withBypassTenantDb(async (tx) => {
      return await tx.query.analystMessages.findMany({
        where: eq(analystMessages.conversationId, conversationId),
        orderBy: [analystMessages.createdAt],
      });
    });

    return {
      success: true,
      data: {
        conversation: conv,
        messages,
      },
    };
  } catch (error: any) {
    console.error("[getAnalystConversationMessagesAction] Error:", error);
    return {
      success: false,
      error: error.message || "Failed to fetch messages",
    };
  }
}

export async function sendAnalystMessageAction(params: {
  conversationId: string;
  content: string;
  selectedAccountId?: number | null;
}) {
  const authContext = await getAuthOrgContext();
  if (!authContext) {
    return { success: false, error: "Unauthorized" };
  }

  const userText = params.content?.trim();
  if (!userText) {
    return { success: false, error: "Message cannot be empty." };
  }

  try {
    let conv = await withBypassTenantDb(async (tx) => {
      return await tx.query.analystConversations.findFirst({
        where: and(
          eq(analystConversations.id, params.conversationId),
          eq(analystConversations.organizationId, authContext.orgId),
        ),
      });
    });

    if (!conv) {
      const id = params.conversationId;
      const [newConv] = await withBypassTenantDb(async (tx) => {
        return await tx
          .insert(analystConversations)
          .values({
            id,
            organizationId: authContext.orgId,
            userId: authContext.userId,
            title: userText.slice(0, 40) + (userText.length > 40 ? "..." : ""),
            adAccountId: params.selectedAccountId || null,
          })
          .returning();
      });
      conv = newConv;
    }

    const [savedUserMessage] = await withBypassTenantDb(async (tx) => {
      return await tx
        .insert(analystMessages)
        .values({
          conversationId: conv!.id,
          role: "user",
          content: userText,
        })
        .returning();
    });

    const existingMessages = await withBypassTenantDb(async (tx) => {
      return await tx.query.analystMessages.findMany({
        where: eq(analystMessages.conversationId, conv!.id),
        orderBy: [analystMessages.createdAt],
      });
    });

    const conversationHistory = existingMessages.map((m) => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
    }));

    const execution = await runAnalystConversationTurn({
      conversationHistory: conversationHistory.slice(0, -1),
      userMessage: userText,
      selectedAccountId: params.selectedAccountId ?? conv!.adAccountId,
      organizationId: authContext.orgId,
      userId: authContext.userId,
    });

    const [savedAssistantMessage] = await withBypassTenantDb(async (tx) => {
      return await tx
        .insert(analystMessages)
        .values({
          conversationId: conv!.id,
          role: "assistant",
          content: execution.reply,
          toolCalls: execution.toolCalls.map((t) => ({
            name: t.name,
            args: t.args,
          })),
          toolResults: execution.toolCalls.map((t) => ({
            name: t.name,
            result: t.result,
          })),
        })
        .returning();
    });

    if (conv!.title === "New Analysis") {
      const updatedTitle =
        userText.slice(0, 45) + (userText.length > 45 ? "..." : "");
      await withBypassTenantDb(async (tx) => {
        await tx
          .update(analystConversations)
          .set({ title: updatedTitle, updatedAt: new Date() })
          .where(eq(analystConversations.id, conv!.id));
      });
    } else {
      await withBypassTenantDb(async (tx) => {
        await tx
          .update(analystConversations)
          .set({ updatedAt: new Date() })
          .where(eq(analystConversations.id, conv!.id));
      });
    }

    return {
      success: true,
      data: {
        userMessage: savedUserMessage,
        assistantMessage: savedAssistantMessage,
        toolCalls: execution.toolCalls,
      },
    };
  } catch (error: any) {
    console.error("[sendAnalystMessageAction] Error:", error);
    return {
      success: false,
      error:
        error.message ||
        "An error occurred while processing your analysis query.",
    };
  }
}

export async function deleteAnalystConversationAction(conversationId: string) {
  const authContext = await getAuthOrgContext();
  if (!authContext) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    await withBypassTenantDb(async (tx) => {
      await tx
        .delete(analystConversations)
        .where(
          and(
            eq(analystConversations.id, conversationId),
            eq(analystConversations.organizationId, authContext.orgId),
          ),
        );
    });

    revalidatePath("/analyst");
    return { success: true };
  } catch (error: any) {
    console.error("[deleteAnalystConversationAction] Error:", error);
    return {
      success: false,
      error: error.message || "Failed to delete conversation",
    };
  }
}

export async function clearAnalystConversationAction(conversationId: string) {
  const authContext = await getAuthOrgContext();
  if (!authContext) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    await withBypassTenantDb(async (tx) => {
      await tx
        .delete(analystMessages)
        .where(eq(analystMessages.conversationId, conversationId));
    });

    revalidatePath("/analyst");
    return { success: true };
  } catch (error: any) {
    console.error("[clearAnalystConversationAction] Error:", error);
    return {
      success: false,
      error: error.message || "Failed to clear conversation",
    };
  }
}

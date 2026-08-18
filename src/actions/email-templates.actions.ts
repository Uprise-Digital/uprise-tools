"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/db";
import { member, organizationEmailTemplates } from "@/db/schema";
import { auth } from "@/lib/auth";
import { SYSTEM_EMAIL_TEMPLATES } from "@/lib/email-service";

export async function getEmailTemplatesAction() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return { success: false, error: "Unauthorized" };
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
      return { success: false, error: "No active organization" };
    }

    const dbTemplates = await db.query.organizationEmailTemplates.findMany({
      where: eq(organizationEmailTemplates.organizationId, orgId),
    });

    const dbMap = new Map(dbTemplates.map((t) => [t.templateKey, t]));

    const templates = Object.values(SYSTEM_EMAIL_TEMPLATES).map((def) => {
      const dbRecord = dbMap.get(def.key);
      return {
        key: def.key,
        name: def.name,
        category: def.category,
        defaultSubject: def.defaultSubject,
        defaultHtml: def.defaultHtml,
        subject: dbRecord?.subject || def.defaultSubject,
        bodyHtml: dbRecord?.bodyHtml || def.defaultHtml,
        bodyText: dbRecord?.bodyText || "",
        isCustomized: Boolean(dbRecord),
        variables: def.variables,
      };
    });

    return {
      success: true,
      templates,
    };
  } catch (err: any) {
    console.error("Failed to get email templates:", err);
    return { success: false, error: err.message };
  }
}

export async function saveEmailTemplateAction(payload: {
  templateKey: string;
  subject: string;
  bodyHtml: string;
  bodyText?: string;
}) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return { success: false, error: "Unauthorized" };
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
      return { success: false, error: "No active organization" };
    }

    const existing = await db.query.organizationEmailTemplates.findFirst({
      where: and(
        eq(organizationEmailTemplates.organizationId, orgId),
        eq(organizationEmailTemplates.templateKey, payload.templateKey),
      ),
    });

    if (existing) {
      await db
        .update(organizationEmailTemplates)
        .set({
          subject: payload.subject,
          bodyHtml: payload.bodyHtml,
          bodyText: payload.bodyText || null,
          updatedAt: new Date(),
        })
        .where(eq(organizationEmailTemplates.id, existing.id));
    } else {
      await db.insert(organizationEmailTemplates).values({
        organizationId: orgId,
        templateKey: payload.templateKey,
        subject: payload.subject,
        bodyHtml: payload.bodyHtml,
        bodyText: payload.bodyText || null,
      });
    }

    revalidatePath("/settings");

    return { success: true };
  } catch (err: any) {
    console.error("Failed to save email template:", err);
    return { success: false, error: err.message };
  }
}

export async function resetEmailTemplateAction(templateKey: string) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return { success: false, error: "Unauthorized" };
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
      return { success: false, error: "No active organization" };
    }

    await db
      .delete(organizationEmailTemplates)
      .where(
        and(
          eq(organizationEmailTemplates.organizationId, orgId),
          eq(organizationEmailTemplates.templateKey, templateKey),
        ),
      );

    revalidatePath("/settings");

    return { success: true };
  } catch (err: any) {
    console.error("Failed to reset email template:", err);
    return { success: false, error: err.message };
  }
}

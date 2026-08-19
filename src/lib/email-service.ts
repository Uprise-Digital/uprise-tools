import { and, eq } from "drizzle-orm";
import { Resend } from "resend";
import { db } from "@/db";
import {
  emailLogs,
  organization,
  organizationEmailTemplates,
} from "@/db/schema";

export interface SystemTemplateDefinition {
  key: string;
  name: string;
  category: "client" | "team" | "auth";
  defaultSubject: string;
  defaultHtml: string;
  variables: Array<{ name: string; description: string }>;
}

export const SYSTEM_EMAIL_TEMPLATES: Record<string, SystemTemplateDefinition> =
  {
    onboarding_welcome: {
      key: "onboarding_welcome",
      name: "Client Onboarding Welcome",
      category: "client",
      defaultSubject: "Welcome to {{agency_name}} - Let's get started!",
      defaultHtml: `<p>Hi {{primary_contact_name}},</p>
<p>Great to have you on board with <strong>{{agency_name}}</strong>!</p>
<p>To help us hit the ground running, please complete your onboarding steps below:</p>
<ul>
  <li><strong>Media Assets Folder:</strong> <a href="{{drive_link}}">Upload Assets Here</a></li>
  <li><strong>Client Dashboard:</strong> <a href="{{notion_link}}">Access Notion Dashboard</a></li>
  <li><strong>Signal Group:</strong> <a href="{{signal_link}}">Join Group Chat</a></li>
</ul>
<p>Feel free to reach out if you have any questions!</p>`,
      variables: [
        {
          name: "primary_contact_name",
          description: "Primary contact full name",
        },
        { name: "client_name", description: "Client company name" },
        { name: "drive_link", description: "Google Drive folder URL" },
        { name: "notion_link", description: "Notion dashboard URL" },
        { name: "signal_link", description: "Signal group chat URL" },
        { name: "agency_name", description: "Your agency display name" },
      ],
    },
    daily_briefing: {
      key: "daily_briefing",
      name: "Executive Morning Briefing",
      category: "team",
      defaultSubject: "☀️ Executive Daily Briefing - {{date}}",
      defaultHtml: `<h2>Executive Morning Briefing</h2>
<p>Good morning! Here is your daily performance summary for <strong>{{agency_name}}</strong> on {{date}}.</p>
<div>{{briefing_content}}</div>
<p style="font-size: 11px; color: #64748b; margin-top: 20px;">Queries or issues can be directed to support: {{support_email}}</p>`,
      variables: [
        { name: "date", description: "Current formatted date" },
        {
          name: "briefing_content",
          description: "HTML summary of key agency metrics and alerts",
        },
        { name: "agency_name", description: "Your agency display name" },
        { name: "support_email", description: "Agency support email address" },
      ],
    },
    client_report: {
      key: "client_report",
      name: "Client Performance Report",
      category: "client",
      defaultSubject: "{{agency_name}} - Performance Report: {{client_name}}",
      defaultHtml: `<p>Hello,</p>
<p>Attached is the latest performance audit & report for <strong>{{client_name}}</strong> from <strong>{{agency_name}}</strong>.</p>
<p><a href="{{report_url}}" style="display: inline-block; padding: 10px 18px; background-color: #4f46e5; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold;">View Interactive Report</a></p>
<p>Thank you for partnering with {{agency_name}}.</p>`,
      variables: [
        { name: "client_name", description: "Client account name" },
        {
          name: "report_url",
          description: "Link to interactive performance report",
        },
        { name: "agency_name", description: "Your agency display name" },
      ],
    },
    pipeline_digest: {
      key: "pipeline_digest",
      name: "Pipeline Stalled Leads Digest",
      category: "team",
      defaultSubject:
        "⚠️ Pipeline Sales Digest: {{stalled_count}} Stalled Deals Requires Attention",
      defaultHtml: `<h2>Sales Pipeline Assistant</h2>
<p>There are currently <strong>{{stalled_count}}</strong> stalled deal opportunities requiring sales follow-up across {{agency_name}}.</p>
<div>{{pipeline_content}}</div>
<p><a href="{{pipeline_url}}">View Pipeline Dashboard</a></p>`,
      variables: [
        {
          name: "stalled_count",
          description: "Number of stalled deal opportunities",
        },
        { name: "pipeline_content", description: "HTML list of stalled leads" },
        {
          name: "pipeline_url",
          description: "Direct URL to pipeline dashboard",
        },
        { name: "agency_name", description: "Your agency display name" },
      ],
    },
    team_invite: {
      key: "team_invite",
      name: "Team Member Invitation",
      category: "auth",
      defaultSubject: "You've been invited to join {{agency_name}}",
      defaultHtml: `<h2>Join {{agency_name}}</h2>
<p>You have been invited to join the <strong>{{agency_name}}</strong> workspace as a <strong>{{role}}</strong>.</p>
<p><a href="{{invite_url}}" style="display: inline-block; padding: 10px 18px; background-color: #4f46e5; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold;">Accept Invitation & Join</a></p>`,
      variables: [
        {
          name: "role",
          description: "Assigned member role (Admin, Member, etc.)",
        },
        { name: "invite_url", description: "Invitation acceptance link" },
        { name: "agency_name", description: "Your agency display name" },
      ],
    },
  };

export interface SendSystemEmailParams {
  organizationId?: string;
  templateKey: string;
  to: string | string[];
  replyTo?: string;
  variables?: Record<string, string>;
  customSubject?: string;
  customHtml?: string;
  attachments?: Array<{ filename: string; content: Buffer }>;
}

export async function sendSystemEmail(params: SendSystemEmailParams) {
  const {
    organizationId,
    templateKey,
    to,
    replyTo,
    variables = {},
    customSubject,
    customHtml,
    attachments,
  } = params;

  let brandName = "Agency";
  let logoUrl = "";
  let emailSignature = "";
  let websiteUrl = "";
  let supportEmail = "support@agency.com";

  if (organizationId) {
    const org = await db.query.organization.findFirst({
      where: eq(organization.id, organizationId),
    });
    if (org) {
      brandName = org.brandName || org.name || "Agency";
      logoUrl = org.logoUrl || org.logo || "";
      emailSignature = org.emailSignature || "";
      websiteUrl = org.websiteUrl || "";
      supportEmail = org.supportEmail || "support@agency.com";
    }
  }

  let templateSubject: string = customSubject || "";
  let templateHtml: string = customHtml || "";

  if (!templateSubject || !templateHtml) {
    let customDbTemplate: any = null;
    if (organizationId) {
      customDbTemplate = await db.query.organizationEmailTemplates.findFirst({
        where: and(
          eq(organizationEmailTemplates.organizationId, organizationId),
          eq(organizationEmailTemplates.templateKey, templateKey),
        ),
      });
    }

    const defaultDef = SYSTEM_EMAIL_TEMPLATES[templateKey];
    templateSubject =
      customSubject ||
      customDbTemplate?.subject ||
      defaultDef?.defaultSubject ||
      "Notification";
    templateHtml =
      customHtml ||
      customDbTemplate?.bodyHtml ||
      defaultDef?.defaultHtml ||
      "<p>Notification email.</p>";
  }

  const allVars: Record<string, string> = {
    agency_name: brandName,
    logo_url: logoUrl,
    website_url: websiteUrl,
    support_email: supportEmail,
    signature: emailSignature,
    ...variables,
  };

  let renderedSubject: string = templateSubject;
  let renderedHtml: string = templateHtml;

  for (const [k, v] of Object.entries(allVars)) {
    const regex = new RegExp(`{{\\s*${k}\\s*}}`, "g");
    renderedSubject = renderedSubject.replace(regex, v || "");
    renderedHtml = renderedHtml.replace(regex, v || "");
  }

  const headerLogoHtml = logoUrl
    ? `<div style="margin-bottom: 20px;"><img src="${logoUrl}" alt="${brandName}" style="max-height: 48px; display: block;" /></div>`
    : "";

  const formattedSigHtml = emailSignature
    ? `<div style="font-size: 13px; color: #475569; margin-top: 24px; pt-2 border-t border-slate-200">${emailSignature.replace(/\n/g, "<br/>")}</div>`
    : `<p style="font-size: 14px; font-weight: bold; margin: 24px 0 4px 0; color: #0f172a;">${brandName} Team</p>
${websiteUrl ? `<p style="font-size: 12px; color: #64748b; margin: 0;"><a href="${websiteUrl}" style="color: #4f46e5; text-decoration: none;">${websiteUrl}</a></p>` : ""}`;

  const fullHtml = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px;">
  ${headerLogoHtml}
  ${renderedHtml}
  <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
  ${formattedSigHtml}
</div>`;

  const recipients = Array.isArray(to) ? to : [to];
  const primaryRecipient = recipients[0] || "";

  try {
    const resend = new Resend(
      process.env.RESEND_API_KEY || "re_dummy_build_key",
    );
    const fromAddress =
      process.env.SENDER_EMAIL ||
      "Uprise Digital <reports@uprisedigital.com.au>";

    const emailResult = await resend.emails.send({
      from: fromAddress,
      to: recipients,
      replyTo: replyTo || undefined,
      subject: renderedSubject,
      html: fullHtml,
      attachments: attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
      })),
    });

    await db.insert(emailLogs).values({
      organizationId: organizationId || "default-org",
      recipient: primaryRecipient,
      subject: renderedSubject,
      emailType: templateKey,
      status: "success",
      resendId: (emailResult as any)?.data?.id || null,
      sentAt: new Date(),
    });

    return {
      success: true,
      resendId: (emailResult as any)?.data?.id,
    };
  } catch (err: any) {
    console.error(
      `[Email Service Error] Failed to send email (${templateKey}):`,
      err,
    );

    await db.insert(emailLogs).values({
      organizationId: organizationId || "default-org",
      recipient: primaryRecipient,
      subject: renderedSubject,
      emailType: templateKey,
      status: "failed",
      error: err.message || "Email dispatch failed",
      sentAt: new Date(),
    });

    return {
      success: false,
      error: err.message || "Failed to send email",
    };
  }
}

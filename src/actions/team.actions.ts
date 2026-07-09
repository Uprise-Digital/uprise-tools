"use server";

import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/db";
import { account, user, member, invitation, auditLogs } from "@/db/schema";
import { logAction } from "@/lib/audit";
import { auth } from "@/lib/auth";

export async function getTeamMembers() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  let orgId = session.session.activeOrganizationId;
  if (!orgId) {
    const userMember = await db.query.member.findFirst({
      where: eq(member.userId, session.user.id),
    });
    if (userMember) {
      orgId = userMember.organizationId;
    }
  }

  if (!orgId) return [];

  const members = await db
    .select({
      id: user.id,
      memberId: member.id,
      name: user.name,
      email: user.email,
      role: member.role,
      createdAt: member.createdAt,
    })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(eq(member.organizationId, orgId));

  return members;
}

export async function getTeamInvitationsAction() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  let orgId = session.session.activeOrganizationId;
  if (!orgId) {
    const userMember = await db.query.member.findFirst({
      where: eq(member.userId, session.user.id),
    });
    if (userMember) {
      orgId = userMember.organizationId;
    }
  }

  if (!orgId) return [];

  return await db
    .select()
    .from(invitation)
    .where(
      and(
        eq(invitation.organizationId, orgId),
        eq(invitation.status, "pending")
      )
    );
}

export async function inviteTeamMemberAction(payload: {
  email: string;
  role: string;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  let orgId = session.session.activeOrganizationId;
  if (!orgId) {
    const userMember = await db.query.member.findFirst({
      where: eq(member.userId, session.user.id),
    });
    if (userMember) {
      orgId = userMember.organizationId;
    }
  }

  if (!orgId) throw new Error("No active organization found");

  // Verify caller is admin or owner
  const callerMember = await db.query.member.findFirst({
    where: and(
      eq(member.userId, session.user.id),
      eq(member.organizationId, orgId)
    ),
  });

  if (!callerMember || (callerMember.role !== "owner" && callerMember.role !== "admin")) {
    throw new Error("Unauthorized: Only owners or admins can invite team members");
  }

  // Create invitation
  const inviteId = crypto.randomUUID();
  await db.insert(invitation).values({
    id: inviteId,
    organizationId: orgId,
    email: payload.email,
    role: payload.role,
    status: "pending",
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    inviterId: session.user.id,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Send email via Resend
  const { Resend } = await import("resend");
  const resend = new Resend(process.env.RESEND_API_KEY!);
  
  // Resolve app URL for accept link
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const inviteLink = `${appUrl}/signup?invite=${inviteId}`;

  await resend.emails.send({
    from: "Agency Alerts <alerts@uprisedigital.com.au>",
    to: payload.email,
    subject: "You've been invited to join Uprise Tools",
    html: `
      <div style="font-family: sans-serif; padding: 24px; color: #1e293b; max-width: 500px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #4f46e5; margin-top: 0;">Join your agency on Uprise Tools</h2>
        <p>Hi,</p>
        <p>You have been invited to join the organization on Uprise Tools as a <strong>${payload.role}</strong>.</p>
        <p style="margin: 24px 0;">
          <a href="${inviteLink}" style="background-color: #4f46e5; color: white; padding: 10px 18px; text-decoration: none; font-weight: bold; border-radius: 6px; font-size: 14px;">Accept Invitation</a>
        </p>
        <p style="font-size: 12px; color: #64748b; margin-top: 32px;">This invitation will expire in 7 days. If you did not expect this invitation, you can safely ignore this email.</p>
      </div>
    `,
  });

  // Audit Log
  await logAction(session.user.id, "INVITE_USER", "invitation", inviteId, {
    email: payload.email,
    role: payload.role,
  });

  revalidatePath("/team");
  return { success: true };
}

export async function cancelTeamInvitationAction(payload: {
  invitationId: string;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  await db.delete(invitation).where(eq(invitation.id, payload.invitationId));

  await logAction(session.user.id, "CANCEL_INVITATION", "invitation", payload.invitationId, {});

  revalidatePath("/team");
  return { success: true };
}

export async function updateTeamMemberRoleAction(payload: {
  memberUserId: string;
  role: string;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  let orgId = session.session.activeOrganizationId;
  if (!orgId) {
    const userMember = await db.query.member.findFirst({
      where: eq(member.userId, session.user.id),
    });
    if (userMember) {
      orgId = userMember.organizationId;
    }
  }
  if (!orgId) throw new Error("No active organization found");

  // Check caller is owner or admin
  const callerMember = await db.query.member.findFirst({
    where: and(
      eq(member.userId, session.user.id),
      eq(member.organizationId, orgId)
    ),
  });
  if (!callerMember || (callerMember.role !== "owner" && callerMember.role !== "admin")) {
    throw new Error("Unauthorized: Only owners or admins can modify roles");
  }

  // If demoting/updating, admin cannot update owner
  const targetMember = await db.query.member.findFirst({
    where: and(
      eq(member.userId, payload.memberUserId),
      eq(member.organizationId, orgId)
    ),
  });
  if (!targetMember) throw new Error("Target member not found");

  if (targetMember.role === "owner" && callerMember.role !== "owner") {
    throw new Error("Unauthorized: Admins cannot change owner roles");
  }

  await db
    .update(member)
    .set({ role: payload.role, updatedAt: new Date() })
    .where(
      and(
        eq(member.userId, payload.memberUserId),
        eq(member.organizationId, orgId)
      )
    );

  await logAction(session.user.id, "UPDATE_USER_ROLE", "member", targetMember.id, {
    targetUserId: payload.memberUserId,
    newRole: payload.role,
  });

  revalidatePath("/team");
  return { success: true };
}

export async function deleteTeamMember(
  targetUserId: string,
  targetUserName: string
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  let orgId = session.session.activeOrganizationId;
  if (!orgId) {
    const userMember = await db.query.member.findFirst({
      where: eq(member.userId, session.user.id),
    });
    if (userMember) {
      orgId = userMember.organizationId;
    }
  }
  if (!orgId) throw new Error("No active organization found");

  // Check caller permissions
  const callerMember = await db.query.member.findFirst({
    where: and(
      eq(member.userId, session.user.id),
      eq(member.organizationId, orgId)
    ),
  });
  if (!callerMember || (callerMember.role !== "owner" && callerMember.role !== "admin")) {
    throw new Error("Unauthorized");
  }

  const targetMember = await db.query.member.findFirst({
    where: and(
      eq(member.userId, targetUserId),
      eq(member.organizationId, orgId)
    ),
  });
  if (!targetMember) throw new Error("Member not found");

  if (targetMember.role === "owner" && callerMember.role !== "owner") {
    throw new Error("Unauthorized: Admins cannot remove organization owners");
  }

  await db
    .delete(member)
    .where(
      and(
        eq(member.userId, targetUserId),
        eq(member.organizationId, orgId)
      )
    );

  await logAction(session.user.id, "REMOVE_TEAM_MEMBER", "member", targetMember.id, {
    removedUserId: targetUserId,
  });

  revalidatePath("/team");
  return { success: true };
}

export async function addTeamMember(formData: FormData) {
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const role = (formData.get("role") as string) || "member";

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  let orgId = session.session.activeOrganizationId;
  if (!orgId) {
    const userMember = await db.query.member.findFirst({
      where: eq(member.userId, session.user.id),
    });
    if (userMember) {
      orgId = userMember.organizationId;
    }
  }
  if (!orgId) throw new Error("No active organization found");

  // 1. Insert the user
  const newUserId = crypto.randomUUID();
  await db.insert(user).values({
    id: newUserId,
    name,
    email,
    emailVerified: true, // Auto-verified when directly added by admin
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // 2. Insert account
  await db.insert(account).values({
    id: crypto.randomUUID(),
    accountId: newUserId,
    providerId: "credential",
    userId: newUserId,
    password: password,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // 3. Insert member organization link
  await db.insert(member).values({
    id: crypto.randomUUID(),
    organizationId: orgId,
    userId: newUserId,
    role: role,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // 4. Fire audit log
  await logAction(session.user.id, "CREATE_USER", "user", newUserId, {
    name,
    email,
    role,
  });

  revalidatePath("/team");
}

export async function getUserActivityLogsAction(payload: {
  targetUserId: string;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  let orgId = session.session.activeOrganizationId;
  if (!orgId) {
    const userMember = await db.query.member.findFirst({
      where: eq(member.userId, session.user.id),
    });
    if (userMember) {
      orgId = userMember.organizationId;
    }
  }
  if (!orgId) return { success: false, error: "No organization found" };

  const logs = await db.query.auditLogs.findMany({
    where: and(
      eq(auditLogs.actorId, payload.targetUserId),
      eq(auditLogs.organizationId, orgId)
    ),
    orderBy: (l, { desc }) => [desc(l.createdAt)],
    limit: 150,
  });

  const serializedLogs = logs.map((log) => ({
    id: log.id,
    action: log.action,
    targetTable: log.targetTable,
    targetId: log.targetId,
    metadata: log.metadata,
    createdAt: log.createdAt.toISOString(),
  }));

  return { success: true, logs: serializedLogs };
}

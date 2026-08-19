"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/db";
import { account, auditLogs, invitation, member, organization, user } from "@/db/schema";
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
        eq(invitation.status, "pending"),
      ),
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
      eq(member.organizationId, orgId),
    ),
  });

  if (
    !callerMember ||
    (callerMember.role !== "owner" && callerMember.role !== "admin")
  ) {
    throw new Error(
      "Unauthorized: Only owners or admins can invite team members",
    );
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

  const { sendSystemEmail } = await import("@/lib/email-service");

  // Resolve app URL for accept link
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const inviteLink = `${appUrl}/signup?invite=${inviteId}`;

  await sendSystemEmail({
    organizationId: orgId,
    templateKey: "team_invite",
    to: payload.email,
    variables: {
      role: payload.role,
      invite_url: inviteLink,
    },
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

  await logAction(
    session.user.id,
    "CANCEL_INVITATION",
    "invitation",
    payload.invitationId,
    {},
  );

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
      eq(member.organizationId, orgId),
    ),
  });
  if (
    !callerMember ||
    (callerMember.role !== "owner" && callerMember.role !== "admin")
  ) {
    throw new Error("Unauthorized: Only owners or admins can modify roles");
  }

  // If demoting/updating, admin cannot update owner
  const targetMember = await db.query.member.findFirst({
    where: and(
      eq(member.userId, payload.memberUserId),
      eq(member.organizationId, orgId),
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
        eq(member.organizationId, orgId),
      ),
    );

  await logAction(
    session.user.id,
    "UPDATE_USER_ROLE",
    "member",
    targetMember.id,
    {
      targetUserId: payload.memberUserId,
      newRole: payload.role,
    },
  );

  revalidatePath("/team");
  return { success: true };
}

export async function deleteTeamMember(
  targetUserId: string,
  targetUserName: string,
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
      eq(member.organizationId, orgId),
    ),
  });
  if (
    !callerMember ||
    (callerMember.role !== "owner" && callerMember.role !== "admin")
  ) {
    throw new Error("Unauthorized");
  }

  const targetMember = await db.query.member.findFirst({
    where: and(
      eq(member.userId, targetUserId),
      eq(member.organizationId, orgId),
    ),
  });
  if (!targetMember) throw new Error("Member not found");

  if (targetMember.role === "owner" && callerMember.role !== "owner") {
    throw new Error("Unauthorized: Admins cannot remove organization owners");
  }

  await db
    .delete(member)
    .where(
      and(eq(member.userId, targetUserId), eq(member.organizationId, orgId)),
    );

  await logAction(
    session.user.id,
    "REMOVE_TEAM_MEMBER",
    "member",
    targetMember.id,
    {
      removedUserId: targetUserId,
    },
  );

  revalidatePath("/team");
  return { success: true };
}

export async function addTeamMember(formData: FormData) {
  const name = (formData.get("name") as string)?.trim();
  const email = (formData.get("email") as string)?.toLowerCase().trim();
  const password = formData.get("password") as string;
  const role = (formData.get("role") as string) || "member";

  if (!name || !email || !password) {
    throw new Error("Name, email, and password are required.");
  }
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters long.");
  }

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

  // Verify caller permissions
  const callerMember = await db.query.member.findFirst({
    where: and(
      eq(member.userId, session.user.id),
      eq(member.organizationId, orgId),
    ),
  });
  if (
    !callerMember ||
    (callerMember.role !== "owner" && callerMember.role !== "admin")
  ) {
    throw new Error("Unauthorized: Only owners or admins can add team members");
  }

  // Check if user already exists
  const existingUser = await db.query.user.findFirst({
    where: eq(user.email, email),
  });

  let userId: string;

  if (existingUser) {
    userId = existingUser.id;
  } else {
    // 1. Create user via Better Auth API to ensure proper password hashing
    const res = await auth.api.signUpEmail({
      body: {
        name,
        email,
        password,
      },
    });

    if (!res || !res.user) {
      throw new Error("Failed to create user account with hashed password");
    }
    userId = res.user.id;
  }

  // 2. Check if user is already in organization
  const existingMember = await db.query.member.findFirst({
    where: and(eq(member.userId, userId), eq(member.organizationId, orgId)),
  });

  if (!existingMember) {
    await db.insert(member).values({
      id: crypto.randomUUID(),
      organizationId: orgId,
      userId: userId,
      role: role,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // 3. Fire audit log
  await logAction(session.user.id, "CREATE_USER", "user", userId, {
    name,
    email,
    role,
  });

  revalidatePath("/team");
}

export async function getInvitationDetailsAction(invitationId: string) {
  if (!invitationId) {
    return { success: false, error: "Missing invitation ID" };
  }

  const inviteRecord = await db.query.invitation.findFirst({
    where: eq(invitation.id, invitationId),
  });

  if (!inviteRecord) {
    return { success: false, error: "Invitation not found or invalid" };
  }

  if (inviteRecord.status !== "pending") {
    return {
      success: false,
      error: `Invitation is no longer pending (status: ${inviteRecord.status})`,
    };
  }

  if (new Date(inviteRecord.expiresAt) < new Date()) {
    return { success: false, error: "Invitation has expired" };
  }

  const org = await db.query.organization.findFirst({
    where: eq(organization.id, inviteRecord.organizationId),
  });

  const inviter = await db.query.user.findFirst({
    where: eq(user.id, inviteRecord.inviterId),
  });

  return {
    success: true,
    invitation: {
      id: inviteRecord.id,
      email: inviteRecord.email,
      role: inviteRecord.role,
      organizationName: org?.name || "Organization",
      inviterName: inviter?.name || "Team Admin",
    },
  };
}

export async function acceptInvitationAction(payload: {
  invitationId: string;
  name: string;
  password?: string;
}) {
  const { invitationId, name, password } = payload;

  const inviteRecord = await db.query.invitation.findFirst({
    where: eq(invitation.id, invitationId),
  });

  if (!inviteRecord || inviteRecord.status !== "pending") {
    throw new Error("Invalid or expired invitation");
  }

  if (new Date(inviteRecord.expiresAt) < new Date()) {
    throw new Error("Invitation has expired");
  }

  let targetUserId: string;

  // Check if caller is already logged in (e.g. via Google OAuth)
  const session = await auth.api.getSession({ headers: await headers() });

  if (session && session.user) {
    targetUserId = session.user.id;
  } else {
    if (!password || password.length < 8) {
      throw new Error("Password must be at least 8 characters long");
    }

    const res = await auth.api.signUpEmail({
      body: {
        name,
        email: inviteRecord.email.toLowerCase().trim(),
        password,
      },
    });

    if (!res || !res.user) {
      throw new Error("Failed to register account for invitation");
    }
    targetUserId = res.user.id;
  }

  // Create member record in organization
  const existingMember = await db.query.member.findFirst({
    where: and(
      eq(member.userId, targetUserId),
      eq(member.organizationId, inviteRecord.organizationId),
    ),
  });

  if (!existingMember) {
    await db.insert(member).values({
      id: crypto.randomUUID(),
      organizationId: inviteRecord.organizationId,
      userId: targetUserId,
      role: inviteRecord.role,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // Mark invitation accepted
  await db
    .update(invitation)
    .set({ status: "accepted", updatedAt: new Date() })
    .where(eq(invitation.id, invitationId));

  await logAction(
    targetUserId,
    "ACCEPT_INVITATION",
    "invitation",
    invitationId,
    {
      organizationId: inviteRecord.organizationId,
      role: inviteRecord.role,
    },
  );

  return { success: true };
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
      eq(auditLogs.organizationId, orgId),
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

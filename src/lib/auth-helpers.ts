import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import { member } from "@/db/schema";
import { auth } from "@/lib/auth";

export async function getAuthOrgContext() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session || !session.user) {
    return null;
  }

  const userId = session.user.id;
  let orgId = (session.session as any)?.activeOrganizationId;

  if (!orgId) {
    const userMember = await db.query.member.findFirst({
      where: eq(member.userId, userId),
    });
    if (userMember) {
      orgId = userMember.organizationId;
    }
  }

  if (!orgId) {
    return null;
  }

  const callerMember = await db.query.member.findFirst({
    where: and(eq(member.userId, userId), eq(member.organizationId, orgId)),
  });

  return {
    session,
    user: session.user,
    userId,
    orgId,
    callerMember,
    role: callerMember?.role || "member",
  };
}

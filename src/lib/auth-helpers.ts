import { and, eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
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
    const cookieStore = await cookies();
    const cookieOrgId = cookieStore.get("active_org_id")?.value;
    if (cookieOrgId) {
      // Check if user is actually a member of this cookie orgId
      const isMember = await db.query.member.findFirst({
        where: and(
          eq(member.userId, userId),
          eq(member.organizationId, cookieOrgId),
        ),
      });
      if (isMember) {
        orgId = cookieOrgId;
      }
    }
  }

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

import { and, eq } from "drizzle-orm";
import { ShieldAlert } from "lucide-react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  getTeamInvitationsAction,
  getTeamMembers,
} from "@/actions/team.actions";
import { db } from "@/db";
import { member } from "@/db/schema";
import { auth } from "@/lib/auth";
import { TeamClient } from "./teamClient";

export default async function TeamManagementPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  // Resolve active organization ID
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
    redirect("/onboarding");
  }

  // Get current user's membership details
  const callerMember = await db.query.member.findFirst({
    where: and(
      eq(member.userId, session.user.id),
      eq(member.organizationId, orgId),
    ),
  });

  // Access check: only owners or admins can access team management
  if (
    !callerMember ||
    (callerMember.role !== "owner" && callerMember.role !== "admin")
  ) {
    return (
      <div className="max-w-md mx-auto py-24 text-center space-y-4 font-sans animate-in fade-in duration-200">
        <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-lg font-bold text-slate-800">Access Denied</h2>
        <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
          Only organization owners or administrators have access to team
          management, role configurations, and email invitations.
        </p>
      </div>
    );
  }

  // Fetch team members and pending invitations
  const members = await getTeamMembers();
  const invitations = await getTeamInvitationsAction();

  return (
    <TeamClient
      initialMembers={members}
      initialInvitations={invitations}
      currentUserId={session.user.id}
      currentUserRole={callerMember.role}
    />
  );
}

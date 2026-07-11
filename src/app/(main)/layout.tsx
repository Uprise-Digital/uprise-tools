import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { MainLayout } from "@/components/main-layout";
import { db } from "@/db";
import { member, organization } from "@/db/schema";
import { auth } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  // Fetch all organizations the user belongs to
  const userOrgs = await db
    .select({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
    })
    .from(member)
    .innerJoin(organization, eq(member.organizationId, organization.id))
    .where(eq(member.userId, session.user.id));

  console.log(
    `[Layout Check] User: ${session.user.email} (${session.user.id}), Memberships Count: ${userOrgs.length}`,
  );

  if (userOrgs.length === 0) {
    console.log(
      `[Layout Check] No memberships found. Redirecting user to /onboarding`,
    );
    redirect("/onboarding");
  }

  let activeOrgId = session.session.activeOrganizationId;
  if (!activeOrgId) {
    activeOrgId = userOrgs[0]?.id;
  }

  const activeOrg =
    userOrgs.find((org) => org.id === activeOrgId) || userOrgs[0];
  const userInitials = session.user.name.substring(0, 2).toUpperCase();
  const userName = session.user.name;

  return (
    <MainLayout
      userInitials={userInitials}
      userName={userName}
      organizations={userOrgs}
      activeOrganization={activeOrg}
    >
      {children}
    </MainLayout>
  );
}

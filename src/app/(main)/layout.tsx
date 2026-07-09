import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { MainLayout } from "@/components/main-layout";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { member } from "@/db/schema";
import { eq } from "drizzle-orm";

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

  // Check if user has an active organization membership
  const userMemberships = await db
    .select()
    .from(member)
    .where(eq(member.userId, session.user.id))
    .limit(1);

  console.log(`[Layout Check] User: ${session.user.email} (${session.user.id}), Memberships Count: ${userMemberships.length}, Memberships:`, userMemberships);

  if (userMemberships.length === 0) {
    console.log(`[Layout Check] No memberships found. Redirecting user to /onboarding`);
    redirect("/onboarding");
  }


  const userInitials = session.user.name.substring(0, 2).toUpperCase();
  const userName = session.user.name;

  return (
    <MainLayout userInitials={userInitials} userName={userName}>
      {children}
    </MainLayout>
  );
}


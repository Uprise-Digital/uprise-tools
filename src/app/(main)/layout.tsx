import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { MainLayout } from "@/components/main-layout";
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

  const userInitials = session.user.name.substring(0, 2).toUpperCase();
  const userName = session.user.name;

  return (
    <MainLayout userInitials={userInitials} userName={userName}>
      {children}
    </MainLayout>
  );
}

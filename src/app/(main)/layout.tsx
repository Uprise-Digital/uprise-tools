import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SidebarNav } from "@/components/sidebar-nav";
import { UserMenu } from "@/components/user-menu";
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

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* 1. REMOVED w-64 from here (SidebarNav handles its own width)
                2. Added flex-shrink-0 to prevent the sidebar from being squished
            */}
      <aside className="flex-shrink-0">
        <SidebarNav />
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {" "}
        {/* min-w-0 prevents layout overflow */}
        {/* Header */}
        <header className="h-16 bg-white border-b flex items-center justify-end px-8 shadow-sm z-10">
          <UserMenu initials={userInitials} />
        </header>
        {/* 3. Main is the scrollable area.
                    - h-[calc(100vh-4rem)] makes it exactly the size of the viewport minus the header height
                    - overflow-y-auto allows the internal content to scroll
                */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}

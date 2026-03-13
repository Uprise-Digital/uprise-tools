import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { UserMenu } from "@/components/user-menu";
import { SidebarNav } from "@/components/sidebar-nav"; // Import our new dynamic nav

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
    // 1. Verify the user is logged in
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    // Unauthenticated users trying to access ANY page using this layout get booted to /login
    if (!session) {
        redirect("/login");
    }

    const userInitials = session.user.name.substring(0, 2).toUpperCase();

    return (
        <div className="flex min-h-screen bg-slate-50">
            {/* Sidebar */}
            <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col">
                <div className="p-6">
                    <h2 className="text-2xl font-bold text-white tracking-tight">Uprise <span className="text-blue-200">Tools</span></h2>
                </div>

                {/* Inject the dynamic navigation here */}
                <SidebarNav />

            </aside>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col">
                {/* Header */}
                <header className="h-16 bg-white border-b flex items-center justify-end px-8 shadow-sm">
                    {/* Inject the Client Component here */}
                    <UserMenu initials={userInitials} />
                </header>

                {/* Dynamic Page Content */}
                <main className="p-8 flex-1">
                    {children}
                </main>
            </div>
        </div>
    );
}
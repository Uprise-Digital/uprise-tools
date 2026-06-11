"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, BarChart3, BellRing, Users, ScrollText, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

const navItems = [
    { href: "/", label: "Overview", icon: LayoutDashboard },
    { href: "/accounts", label: "Ad Accounts", icon: BarChart3 },
    { href: "/rules", label: "Alert Rules", icon: BellRing },
    { href: "/reports", label: "Reports", icon: ScrollText },
    { href: "/team", label: "Team Management", icon: Users },
    { href: "/logs", label: "Logs", icon: ScrollText },
];

export function SidebarNav() {
    const pathname = usePathname();

    const NavContent = () => (
        <div className="flex flex-col gap-2">
            {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href));

                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                            "flex items-center gap-3 px-4 py-2.5 rounded-md transition-all font-medium",
                            isActive
                                ? "bg-blue-600 text-white"
                                : "text-slate-400 hover:bg-slate-800 hover:text-white"
                        )}
                    >
                        <Icon className="h-5 w-5 shrink-0" />
                        <span className="truncate">{item.label}</span>
                    </Link>
                );
            })}
        </div>
    );

    return (
        <>
            {/* 1. MOBILE HAMBURGER */}
            <div className="md:hidden p-4 border-b border-slate-800 bg-slate-950">
                <Sheet>
                    <SheetTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-slate-300">
                            <Menu className="h-6 w-6" />
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="bg-slate-950 border-slate-800 text-white w-64">
                        <SheetTitle className="text-left text-blue-500 font-bold mb-4">Uprise Tools</SheetTitle>
                        <NavContent />
                    </SheetContent>
                </Sheet>
            </div>

            {/* 2. FIXED SIDEBAR (Tablet/Desktop) */}
            {/* - h-screen: Ensures it fills the viewport height
                - sticky top-0: Pins it to the top of the viewport
                - shrink-0: Prevents flexbox from squishing it
            */}
            <nav className="hidden md:flex flex-col px-3 py-6 space-y-2 h-screen sticky top-0 bg-slate-950 w-20 lg:w-64 shrink-0 transition-all duration-300 overflow-y-auto">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href));

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            title={item.label}
                            className={cn(
                                "flex items-center gap-3 px-4 py-3 rounded-md transition-all font-medium",
                                isActive
                                    ? "bg-blue-600 text-white"
                                    : "text-slate-400 hover:bg-slate-800 hover:text-white",
                                "lg:justify-start justify-center"
                            )}
                        >
                            <Icon className="h-5 w-5 shrink-0" />
                            <span className="hidden lg:block whitespace-nowrap">{item.label}</span>
                        </Link>
                    );
                })}
            </nav>
        </>
    );
}
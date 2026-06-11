"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, BarChart3, BellRing, Users, ScrollText, Menu, X } from "lucide-react";
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
            {/* 1. MOBILE HAMBURGER (Visible only on < md) */}
            <div className="md:hidden p-4 border-b border-slate-800">
                <Sheet>
                    <SheetTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-slate-300">
                            <Menu className="h-6 w-6" />
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="bg-slate-950 border-slate-800 text-white w-64">
                        <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                        <div className="mt-8">
                            <NavContent />
                        </div>
                    </SheetContent>
                </Sheet>
            </div>

            {/* 2. TABLET (Icon Only) & DESKTOP (Full View) */}
            {/* Hidden on mobile, flex on desktop */}
            <nav className="hidden md:flex flex-col px-3 py-6 space-y-2 h-full bg-slate-950 w-20 lg:w-64 transition-all duration-300">
                {/* We adjust the Link styles inside the map specifically for the collapsed state:
                   The <span> gets hidden on medium screens, showing only icons.
                */}
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href));

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            title={item.label} // Tooltip on hover for icon-only mode
                            className={cn(
                                "flex items-center gap-3 px-4 py-3 rounded-md transition-all font-medium",
                                isActive
                                    ? "bg-blue-600 text-white"
                                    : "text-slate-400 hover:bg-slate-800 hover:text-white",
                                // Center the icon when the label is hidden
                                "lg:justify-start justify-center"
                            )}
                        >
                            <Icon className="h-5 w-5 shrink-0" />
                            {/* Hide text on tablet (md), show on desktop (lg) */}
                            <span className="hidden lg:block">{item.label}</span>
                        </Link>
                    );
                })}
            </nav>
        </>
    );
}
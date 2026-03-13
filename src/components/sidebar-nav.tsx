"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, BarChart3, BellRing, Users, ScrollText } from "lucide-react";
import { cn } from "@/lib/utils"; // shadcn's utility for merging tailwind classes

const navItems = [
    { href: "/", label: "Overview", icon: LayoutDashboard },
    { href: "/accounts", label: "Ad Accounts", icon: BarChart3 },
    { href: "/rules", label: "Alert Rules", icon: BellRing },
    { href: '/reports', label: "Reports", icon: BarChart3 },
    { href: "/team", label: "Team Management", icon: Users },
    { href: "/logs", label: "Logs", icon: ScrollText },
];

export function SidebarNav() {
    const pathname = usePathname();

    return (
        <nav className="flex-1 px-4 space-y-2">
            {navItems.map((item) => {
                const Icon = item.icon;
                // Check if the current path exactly matches or starts with the href (for nested routes)
                const isActive = pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href));

                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                            "flex items-center gap-3 px-4 py-2 rounded-md transition-colors font-medium",
                            isActive
                                ? "bg-blue-600 text-white" // Active state
                                : "text-slate-300 hover:bg-slate-800 hover:text-white" // Inactive & Hover state
                        )}
                    >
                        <Icon className="h-5 w-5" />
                        {item.label}
                    </Link>
                );
            })}
        </nav>
    );
}
"use client";

import {
  BarChart3,
  BellRing,
  ChevronDown,
  FileText,
  Globe,
  LayoutDashboard,
  Menu,
  ScrollText,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { UserMenu } from "@/components/user-menu";
import { cn } from "@/lib/utils";
import { BackgroundTasksIndicator } from "@/components/background-tasks-indicator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth-client";

const navItems = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/accounts", label: "Ad Accounts", icon: BarChart3 },
  { href: "/lp-analysis", label: "LP Analysis", icon: Globe },
  { href: "/ad-audit", label: "Ad Copy", icon: Sparkles },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/mcp", label: "MCP Settings", icon: BellRing },
  { href: "/team", label: "Team Management", icon: Users },
  { href: "/logs", label: "Logs", icon: ScrollText },
  { href: "/settings", label: "Settings", icon: Settings },
];

interface OrgItem {
  id: string;
  name: string;
  slug: string | null;
}

export function MainLayout({
  children,
  userInitials,
  userName,
  organizations = [],
  activeOrganization,
}: {
  children: React.ReactNode;
  userInitials: string;
  userName: string;
  organizations?: OrgItem[];
  activeOrganization?: OrgItem;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSwitchOrg = async (orgId: string) => {
    if (activeOrganization?.id === orgId) return;
    try {
      await authClient.organization.setActive({
        organizationId: orgId,
      });
      window.location.reload();
    } catch (err) {
      console.error("Failed to switch organization:", err);
    }
  };

  const NavContent = () => (
    <div className="flex flex-col gap-1 py-4">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive =
          pathname === item.href ||
          (item.href !== "/" && pathname?.startsWith(item.href));

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={cn(
              "flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl transition-all font-semibold text-xs tracking-wide",
              isActive
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10"
                : "text-slate-400 hover:bg-slate-900 hover:text-white",
            )}
          >
            <Icon className="h-4.5 w-4.5 shrink-0" />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-900 antialiased">
      {/* 1. DESKTOP SIDEBAR */}
      <aside className="hidden md:flex flex-col w-56 bg-slate-950 text-white flex-shrink-0 h-full border-r border-slate-900">
        {/* Brand/Organization Switcher Header */}
        <div className="h-14 border-b border-slate-900 flex items-center px-4 flex-shrink-0">
          {activeOrganization ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 hover:text-white cursor-pointer transition-colors text-xs font-semibold select-none">
                  <span className="text-slate-500 font-bold">/</span>
                  <span className="truncate max-w-[120px]">{activeOrganization.name}</span>
                  <ChevronDown className="w-3 h-3 text-slate-400 shrink-0 ml-0.5" />
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48 bg-slate-950 border-slate-800 text-white z-[100] shadow-xl">
                <div className="px-2 py-1.5 text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                  Switch Organization
                </div>
                {organizations.map((org) => (
                  <DropdownMenuItem
                    key={org.id}
                    onClick={() => handleSwitchOrg(org.id)}
                    className={cn(
                      "cursor-pointer text-xs font-medium px-2 py-1.5 rounded-md hover:bg-slate-900 focus:bg-slate-900 focus:text-white flex items-center justify-between",
                      org.id === activeOrganization.id && "text-indigo-400 font-bold bg-slate-900/50"
                    )}
                  >
                    <span>{org.name}</span>
                    {org.id === activeOrganization.id && (
                      <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-2">
              <Image
                src="/logo_white.png"
                alt="Uprise Tools Logo"
                width={20}
                height={20}
                className="object-contain"
              />
              <span className="font-extrabold text-[11px] tracking-wider uppercase text-slate-100 mt-0.5">
                Uprise Tools
              </span>
            </div>
          )}
        </div>

        {/* Sidebar Nav Items */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="flex flex-col gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href ||
                (item.href !== "/" && pathname?.startsWith(item.href));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl transition-all font-semibold text-xs tracking-wide",
                    isActive
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10"
                      : "text-slate-400 hover:bg-slate-900 hover:text-slate-200",
                  )}
                >
                  <Icon className="h-4.5 w-4.5 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Sidebar Footer Branding */}
        <div className="p-4 border-t border-slate-900 mt-auto flex items-center justify-center gap-2 bg-slate-950">
          <Image
            src="/logo_white.png"
            alt="Uprise Tools Logo"
            width={16}
            height={16}
            className="object-contain opacity-60 hover:opacity-100 transition-opacity"
          />
          <span className="font-extrabold text-[10px] tracking-widest uppercase text-slate-500 hover:text-slate-400 transition-colors">
            Uprise Tools
          </span>
        </div>
      </aside>

      {/* 2. MAIN CONTAINER */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* DESKTOP HEADER */}
        <header className="hidden md:flex h-14 bg-white border-b border-slate-200 px-6 items-center justify-between flex-shrink-0 z-20 shadow-sm">
          <div className="text-xs font-semibold text-slate-400">
            {pathname === "/overview" && "Dashboard / Overview"}
            {pathname?.startsWith("/accounts") && "Dashboard / Ad Accounts"}
            {pathname?.startsWith("/lp-analysis") && "Dashboard / LP Analysis"}
            {pathname?.startsWith("/ad-audit") &&
              "Dashboard / Ad Copy & Creative"}
            {pathname?.startsWith("/reports") && "Dashboard / Reports"}
            {pathname?.startsWith("/mcp") && "Dashboard / MCP settings"}
            {pathname?.startsWith("/team") && "Dashboard / Team"}
            {pathname?.startsWith("/logs") && "Dashboard / Audit logs"}
            {pathname?.startsWith("/settings") && "Dashboard / Settings"}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-500">{userName}</span>
            <UserMenu initials={userInitials} />
          </div>
        </header>

        {/* MOBILE HEADER */}
        <header className="flex md:hidden h-14 bg-white border-b border-slate-200 px-4 items-center justify-between flex-shrink-0 z-20 shadow-sm">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-slate-500 rounded-lg"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="bg-slate-950 border-slate-900 text-white w-56 p-4 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between border-b border-slate-900 pb-4 mb-2">
                  <SheetTitle className="text-left">
                    {activeOrganization ? (
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-900 border border-slate-800 text-slate-200 text-xs font-semibold select-none">
                        <span className="text-slate-500 font-bold">/</span>
                        <span className="truncate max-w-[100px]">{activeOrganization.name}</span>
                      </div>
                    ) : (
                      <span className="font-extrabold text-[11px] tracking-wider uppercase text-slate-100 flex items-center gap-2">
                        <Image
                          src="/logo_white.png"
                          alt="Uprise Tools Logo"
                          width={18}
                          height={18}
                          className="object-contain"
                        />
                        Uprise Tools
                      </span>
                    )}
                  </SheetTitle>
                </div>
                <NavContent />
              </div>

              {/* Mobile Sidebar Footer Branding */}
              <div className="pt-4 border-t border-slate-900 flex items-center justify-center gap-2 mt-auto">
                <Image
                  src="/logo_white.png"
                  alt="Uprise Tools Logo"
                  width={14}
                  height={14}
                  className="object-contain opacity-50"
                />
                <span className="font-extrabold text-[9px] tracking-widest uppercase text-slate-500">
                  Uprise Tools
                </span>
              </div>
            </SheetContent>
          </Sheet>

          <div className="flex items-center gap-2">
            <Image
              src="/logo_black.png"
              alt="Uprise Tools Logo"
              width={18}
              height={18}
              className="object-contain"
            />
            <span className="font-extrabold text-[11px] tracking-wider uppercase text-slate-900 mt-0.5">
              Uprise Tools
            </span>
          </div>

          <UserMenu initials={userInitials} />
        </header>

        {/* 3. CONTENT AREA SCROLL WRAPPER */}
        <div className="flex-1 overflow-y-auto flex flex-col justify-between">
          <main className="p-4 md:p-6 lg:p-8 flex-1">{children}</main>

          {/* 4. FOOTER */}
          <footer className="border-t border-slate-200 bg-white py-3.5 px-6 text-center md:text-left flex flex-col md:flex-row justify-between items-center gap-2">
            <span className="text-[10px] md:text-[11px] text-slate-400 font-bold tracking-wide">
              © {new Date().getFullYear()} Uprise Digital. All rights reserved.
            </span>
            <span className="text-[10px] md:text-[11px] text-slate-400 font-medium">
              For support, contact the{" "}
              <span className="font-bold text-slate-500 hover:text-indigo-500 cursor-pointer">
                Data Engineering Team
              </span>
              .
            </span>
          </footer>
        </div>
      </div>
      <BackgroundTasksIndicator />
    </div>
  );
}

"use client";

import { ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface LandingNavProps {
  isLoggedIn?: boolean;
}

export function LandingNav({ isLoggedIn = false }: LandingNavProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/90 backdrop-blur-md transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
        {/* Brand Logo - Crisp Seka Style */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="h-9 w-9 bg-slate-900 text-white rounded-lg flex items-center justify-center shadow-sm group-hover:bg-black transition-colors">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-bold tracking-tight text-slate-900 group-hover:text-black transition-colors">
              Uprise Tools
            </span>
            <span className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase -mt-1">
              PPC Command OS
            </span>
          </div>
        </Link>

        {/* Desktop Nav Links */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
          <a
            href="#features"
            className="hover:text-slate-900 transition-colors"
          >
            What We Do
          </a>
          <a
            href="#threat-matrix"
            className="hover:text-slate-900 transition-colors"
          >
            Threat Matrix
          </a>
          <a href="#pricing" className="hover:text-slate-900 transition-colors">
            Pricing
          </a>
          <Link href="/docs" className="hover:text-slate-900 transition-colors">
            Docs
          </Link>
        </nav>

        {/* Right CTA */}
        <div className="flex items-center gap-4">
          {isLoggedIn ? (
            <Button
              asChild
              className="bg-black hover:bg-slate-800 text-white font-medium rounded-lg text-sm px-5 py-2.5 shadow-sm transition-all"
            >
              <Link href="/overview" className="flex items-center gap-2">
                Go to Dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors hidden sm:block"
              >
                Sign In
              </Link>
              <Button
                asChild
                className="bg-black hover:bg-slate-800 text-white font-medium rounded-lg text-sm px-5 py-2.5 shadow-sm transition-all"
              >
                <Link href="/signup" className="flex items-center gap-2">
                  Start Free Trial
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

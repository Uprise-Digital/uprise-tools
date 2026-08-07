"use client";

import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LandingNavProps {
  isLoggedIn?: boolean;
}

export function LandingNav({ isLoggedIn = false }: LandingNavProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="h-9 w-9 bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform border border-indigo-400/30">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-black tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              Uprise Tools
            </span>
            <span className="text-[10px] font-semibold tracking-widest text-indigo-400 uppercase -mt-1">
              PPC Command OS
            </span>
          </div>
        </Link>

        {/* Desktop Nav Links */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
          <a href="#features" className="hover:text-white transition-colors">
            Features
          </a>
          <a href="#threat-matrix" className="hover:text-white transition-colors">
            Threat Matrix
          </a>
          <a href="#pricing" className="hover:text-white transition-colors">
            Pricing
          </a>
          <Link href="/docs" className="hover:text-white transition-colors">
            Docs
          </Link>
        </nav>

        {/* Right CTA */}
        <div className="flex items-center gap-4">
          {isLoggedIn ? (
            <Button
              asChild
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl shadow-lg shadow-indigo-600/20 transition-all text-xs sm:text-sm"
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
                className="text-sm font-semibold text-slate-300 hover:text-white transition-colors hidden sm:block"
              >
                Sign In
              </Link>
              <Button
                asChild
                className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/40 transition-all text-xs sm:text-sm px-4 py-2 border border-indigo-400/30"
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

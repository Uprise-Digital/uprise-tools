"use client";

import { Lock, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";

export function LandingFooter() {
  return (
    <footer className="bg-white text-slate-600 border-t border-slate-200 py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-12 border-b border-slate-200">
          {/* Brand & Security */}
          <div className="md:col-span-5 text-left">
            <Link href="/" className="flex items-center gap-3 mb-4">
              <div className="h-8 w-8 bg-black text-white rounded-lg flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <span className="text-xl font-bold text-slate-900">
                Uprise Tools
              </span>
            </Link>
            <p className="text-xs text-slate-500 leading-relaxed max-w-sm mb-6 font-normal">
              The Next-Gen PPC Command Operating System for Performance
              Agencies. Automating Google Ads threat matrix audits, turbo
              negative keyword management, and daily executive briefings.
            </p>

            {/* Security Badges */}
            <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold text-slate-700">
              <span className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 px-3 py-1 rounded-md">
                <ShieldCheck className="h-3.5 w-3.5 text-slate-900" /> AES-256
                Encrypted
              </span>
              <span className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 px-3 py-1 rounded-md">
                <Lock className="h-3.5 w-3.5 text-slate-900" /> Google OAuth 2.0
                Verified
              </span>
            </div>
          </div>

          {/* Links Column 1 */}
          <div className="md:col-span-3 text-left">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4">
              Product Features
            </h4>
            <ul className="space-y-2.5 text-xs font-medium">
              <li>
                <a
                  href="#threat-matrix"
                  className="hover:text-slate-900 transition-colors"
                >
                  Threat Matrix Anomaly Scanner
                </a>
              </li>
              <li>
                <a
                  href="#features"
                  className="hover:text-slate-900 transition-colors"
                >
                  AI Morning Executive Briefings
                </a>
              </li>
              <li>
                <a
                  href="#features"
                  className="hover:text-slate-900 transition-colors"
                >
                  Turbo Negative Keywords
                </a>
              </li>
              <li>
                <a
                  href="#features"
                  className="hover:text-slate-900 transition-colors"
                >
                  Landing Page & SERP Audits
                </a>
              </li>
              <li>
                <a
                  href="#features"
                  className="hover:text-slate-900 transition-colors"
                >
                  GoHighLevel Onboarding Engine
                </a>
              </li>
            </ul>
          </div>

          {/* Links Column 2 */}
          <div className="md:col-span-2 text-left">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4">
              Resources
            </h4>
            <ul className="space-y-2.5 text-xs font-medium">
              <li>
                <Link
                  href="/docs"
                  className="hover:text-slate-900 transition-colors"
                >
                  Documentation
                </Link>
              </li>
              <li>
                <a
                  href="#pricing"
                  className="hover:text-slate-900 transition-colors"
                >
                  Agency Pricing
                </a>
              </li>
              <li>
                <Link
                  href="/login"
                  className="hover:text-slate-900 transition-colors"
                >
                  Agency Login
                </Link>
              </li>
              <li>
                <Link
                  href="/signup"
                  className="hover:text-slate-900 transition-colors"
                >
                  Start Free Trial
                </Link>
              </li>
            </ul>
          </div>

          {/* Links Column 3 */}
          <div className="md:col-span-2 text-left">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4">
              Legal & Support
            </h4>
            <ul className="space-y-2.5 text-xs font-medium">
              <li>
                <Link
                  href="/privacy"
                  className="hover:text-slate-900 transition-colors"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="hover:text-slate-900 transition-colors"
                >
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link
                  href="/security"
                  className="hover:text-slate-900 transition-colors"
                >
                  Security & RLS
                </Link>
              </li>
              <li>
                <a
                  href="mailto:support@uprisedigital.com.au"
                  className="hover:text-slate-900 transition-colors"
                >
                  Support Email
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 font-medium">
          <div>
            © {new Date().getFullYear()} Uprise Digital. All rights reserved.
          </div>
          <div className="mt-4 sm:mt-0">
            Tailored for Performance Agencies in Australia & Global
          </div>
        </div>
      </div>
    </footer>
  );
}

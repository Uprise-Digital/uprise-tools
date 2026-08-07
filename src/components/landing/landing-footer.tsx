"use client";

import Link from "next/link";
import { Sparkles, Shield, Lock, CheckCircle } from "lucide-react";

export function LandingFooter() {
  return (
    <footer className="border-t border-slate-800/80 bg-slate-950 text-slate-400 text-xs py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {/* Brand Col */}
          <div className="space-y-4 md:col-span-1">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="h-8 w-8 bg-indigo-600 rounded-xl flex items-center justify-center text-white">
                <Sparkles className="h-4 w-4" />
              </div>
              <span className="text-base font-black text-white tracking-tight">
                Uprise Tools
              </span>
            </Link>
            <p className="text-slate-400 leading-relaxed">
              The automated PPC command operating system for modern performance agencies. Threat matrix audits, AI morning briefings, and turbo negative keyword management.
            </p>
          </div>

          {/* Product Links */}
          <div className="space-y-3">
            <div className="font-bold text-white uppercase text-[11px] tracking-wider">
              Product
            </div>
            <ul className="space-y-2">
              <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
              <li><a href="#threat-matrix" className="hover:text-white transition-colors">Threat Matrix</a></li>
              <li><a href="#pricing" className="hover:text-white transition-colors">Pricing Tiers</a></li>
              <li><Link href="/docs" className="hover:text-white transition-colors">Documentation</Link></li>
            </ul>
          </div>

          {/* Integration Links */}
          <div className="space-y-3">
            <div className="font-bold text-white uppercase text-[11px] tracking-wider">
              Integrations
            </div>
            <ul className="space-y-2">
              <li><span className="text-slate-300 flex items-center gap-1.5"><CheckCircle className="h-3 w-3 text-emerald-400" /> Google Ads API v23</span></li>
              <li><span className="text-slate-300 flex items-center gap-1.5"><CheckCircle className="h-3 w-3 text-emerald-400" /> GoHighLevel API v2</span></li>
              <li><span className="text-slate-300 flex items-center gap-1.5"><CheckCircle className="h-3 w-3 text-emerald-400" /> Resend & React Email</span></li>
              <li><span className="text-slate-300 flex items-center gap-1.5"><CheckCircle className="h-3 w-3 text-emerald-400" /> Model Context Protocol (MCP)</span></li>
            </ul>
          </div>

          {/* Trust & Security */}
          <div className="space-y-3">
            <div className="font-bold text-white uppercase text-[11px] tracking-wider">
              Security & Privacy
            </div>
            <p className="text-slate-400 leading-relaxed">
              256-bit AES token encryption at rest. Google OAuth standard access permissions.
            </p>
            <div className="flex items-center gap-3 pt-2 text-slate-300">
              <span className="flex items-center gap-1 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-md text-[10px]">
                <Shield className="h-3 w-3 text-indigo-400" /> AES-256
              </span>
              <span className="flex items-center gap-1 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-md text-[10px]">
                <Lock className="h-3 w-3 text-emerald-400" /> OAuth 2.0
              </span>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-900 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px]">
          <div>
            © {new Date().getFullYear()} Uprise Tools. All rights reserved.
          </div>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
            <Link href="/docs" className="hover:text-white transition-colors">Security Overview</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

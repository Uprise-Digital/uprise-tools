"use client";

import {
  Check,
  Globe,
  Kanban,
  Lock,
  Mail,
  ShieldAlert,
  Zap,
} from "lucide-react";

export function FeaturesGrid() {
  const capabilities = [
    {
      id: "threat-matrix",
      title: "Google Ads Threat Matrix",
      category: "Real-Time Anomaly Scanner",
      icon: ShieldAlert,
      description:
        "Continuously monitors your entire MCC portfolio for budget spikes, high-CPC anomalies, conversion drops, and broken landing page URLs.",
      bullets: [
        "Hourly metric anomaly scanner",
        "Custom account triage thresholds",
        "Instant email & webhook alerts",
      ],
      tag: "⚡ Saved $18.4k this month",
    },
    {
      id: "briefings",
      title: "AI Morning Briefings",
      category: "Automated Executive Emails",
      icon: Mail,
      description:
        "Dispatches AI-summarized executive performance updates directly to your clients every morning at 7:00 AM with zero manual effort.",
      bullets: [
        "Powered by Gemini AI reasoning",
        "Executive PDF generation & email delivery",
        "Custom client instruction routing",
      ],
      tag: "✨ 100% Client Delivery Score",
    },
    {
      id: "negative-keywords",
      title: "Turbo Negative Keywords",
      category: "Wasted Spend Exclusion",
      icon: Zap,
      description:
        "Scans search query reports across exact, phrase, and broad match terms to filter out non-converting traffic before it drains budgets.",
      bullets: [
        "1-Click Google Ads API execution",
        "Broad, Phrase, & Exact recommendations",
        "Historical negative audit trail",
      ],
      tag: "🎯 342 Exclusions Applied",
    },
    {
      id: "landing-pages",
      title: "Landing Page & SERP Audits",
      category: "CRO & Competitor Analysis",
      icon: Globe,
      description:
        "Scrapes landing pages and competitor ad positioning to evaluate hero copy, trust signals, CTA placement, and mobile speed.",
      bullets: [
        "DOM source scraper & CRO audit",
        "Competitor SERP ad positioning matrix",
        "Actionable fixes for higher Quality Scores",
      ],
      tag: "🔍 88/100 Avg Audit Score",
    },
    {
      id: "pipeline",
      title: "GoHighLevel & Onboarding",
      category: "4-Step Client Wizard",
      icon: Kanban,
      description:
        "Guides new clients through self-serve MCC linking, GHL contact sync, asset collection, and automated onboarding emails.",
      bullets: [
        "Self-serve client onboarding stepper",
        "Automatic GHL pipeline stage updates",
        "Google Drive & Notion folder setup",
      ],
      tag: "🚀 2-Min Self-Serve Setup",
    },
    {
      id: "security",
      title: "Multi-Tenant Security & RLS",
      category: "Enterprise Compliance",
      icon: Lock,
      description:
        "Enforces strict PostgreSQL Row-Level Security (RLS) and AES-256 encryption to guarantee complete data isolation per agency client.",
      bullets: [
        "PostgreSQL RLS tenant isolation",
        "Role-based agency team access",
        "AES-256 OAuth credential encryption",
      ],
      tag: "🛡️ SOC2 & OAuth Verified",
    },
  ];

  return (
    <section
      id="features"
      className="py-24 bg-slate-50 border-b border-slate-200"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header - SOLID BLACK */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 mb-4">
            Everything Performance Agencies Need in One System.
          </h2>
          <p className="text-base sm:text-lg text-slate-600 font-normal">
            Replace fragmented scripts, manual spreadsheets, and missed account
            threats with an automated agency operating system.
          </p>
        </div>

        {/* 3-Column Editorial Grid (No Tabs, No Scrollbars!) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {capabilities.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.id}
                className="bg-white border border-slate-200 rounded-2xl p-8 text-left shadow-sm hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Top Category Badge & Icon */}
                  <div className="flex items-center justify-between mb-5">
                    <div className="h-10 w-10 bg-black text-white rounded-lg flex items-center justify-center shrink-0">
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-md">
                      {item.category}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-xl font-bold text-slate-900 mb-2">
                    {item.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal mb-6">
                    {item.description}
                  </p>

                  {/* Bullet Points */}
                  <div className="space-y-2.5 mb-6 border-t border-slate-100 pt-5">
                    {item.bullets.map((bullet, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2.5 text-xs text-slate-800 font-semibold"
                      >
                        <Check className="h-3.5 w-3.5 text-slate-900 shrink-0" />
                        <span>{bullet}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bottom Metric Badge */}
                <div className="pt-4 border-t border-slate-100 text-xs font-bold text-slate-900 flex items-center justify-between">
                  <span>{item.tag}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

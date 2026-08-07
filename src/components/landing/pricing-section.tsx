"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PricingSection() {
  const [isAnnual, setIsAnnual] = useState(true);

  const tiers = [
    {
      name: "Starter Agency",
      id: "starter",
      priceMonthly: "$49",
      priceAnnual: "$39",
      description: "Ideal for boutique agencies managing up to 10 Google Ads client accounts.",
      features: [
        "Up to 10 Google Ads Accounts",
        "Automated Daily Briefings",
        "Basic Threat Anomaly Scanning",
        "5 Landing Page Audits / Month",
        "Email Support",
      ],
      cta: "Start 14-Day Trial",
      popular: false,
    },
    {
      name: "Pro Agency",
      id: "pro",
      priceMonthly: "$199",
      priceAnnual: "$159",
      description: "For fast-growing agencies needing automated threat matrix & AI briefings.",
      features: [
        "Up to 50 Google Ads Accounts",
        "Threat Matrix Real-Time Anomaly Scanner",
        "Turbo Negative Keyword Generator",
        "GoHighLevel & Client Onboarding Pipeline",
        "Unlimited Landing Page & SERP Audits",
        "Priority Agency Support",
      ],
      cta: "Start Free Pro Trial",
      popular: true,
    },
    {
      name: "Scale & White-Label",
      id: "scale",
      priceMonthly: "$499",
      priceAnnual: "$399",
      description: "For enterprise agencies managing large MCC portfolios with custom branding.",
      features: [
        "Unlimited Google Ads Accounts",
        "Full Multi-Tenant White-Labeling",
        "Custom AI Model Prompts & Tuning",
        "Dedicated Database Tenant Isolation",
        "24/7 Slack / Teams VIP Support",
        "Custom API & Webhooks Access",
      ],
      cta: "Contact Enterprise Sales",
      popular: false,
    },
  ];

  return (
    <section id="pricing" className="py-24 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Title */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-950/60 border border-indigo-500/30 text-indigo-300 text-xs font-semibold mb-4">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Simple, Transparent Pricing for Agencies</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white mb-6">
            Scale Your Agency Without{" "}
            <span className="bg-gradient-to-r from-indigo-400 via-violet-300 to-cyan-400 bg-clip-text text-transparent">
              Per-Account Penalties.
            </span>
          </h2>
          <p className="text-slate-300 text-base sm:text-lg leading-relaxed">
            All plans include a 14-day risk-free trial. Upgrade, downgrade, or cancel anytime with one click.
          </p>

          {/* Billing Cycle Toggle */}
          <div className="flex items-center justify-center gap-3 mt-8">
            <span className={`text-sm font-semibold ${!isAnnual ? "text-white" : "text-slate-400"}`}>
              Monthly Billing
            </span>
            <button
              onClick={() => setIsAnnual(!isAnnual)}
              className="w-14 h-8 rounded-full bg-slate-900 border border-slate-700 p-1 relative transition-colors focus:outline-none"
            >
              <div
                className={`w-6 h-6 rounded-full bg-indigo-500 transition-transform ${
                  isAnnual ? "translate-x-6" : "translate-x-0"
                }`}
              />
            </button>
            <span className={`text-sm font-semibold flex items-center gap-1.5 ${isAnnual ? "text-white" : "text-slate-400"}`}>
              Annual Billing
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-extrabold border border-emerald-500/30">
                SAVE 20%
              </span>
            </span>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
          {tiers.map((tier) => {
            const price = isAnnual ? tier.priceAnnual : tier.priceMonthly;
            return (
              <div
                key={tier.id}
                className={`relative rounded-3xl p-8 flex flex-col justify-between transition-all ${
                  tier.popular
                    ? "bg-slate-900/90 border-2 border-indigo-500 shadow-2xl shadow-indigo-600/20 scale-105 z-10"
                    : "bg-slate-900/50 border border-slate-800 hover:border-slate-700"
                }`}
              >
                {tier.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-xs font-black tracking-wider uppercase shadow-lg border border-indigo-400/30">
                    Most Popular for Agencies
                  </div>
                )}

                <div>
                  <h3 className="text-xl font-bold text-white mb-2">{tier.name}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed mb-6 font-medium">
                    {tier.description}
                  </p>

                  <div className="flex items-baseline gap-1 mb-6">
                    <span className="text-4xl sm:text-5xl font-black text-white">{price}</span>
                    <span className="text-slate-400 text-sm font-medium">/ month</span>
                    {isAnnual && <span className="text-xs text-slate-500 ml-1">billed yearly</span>}
                  </div>

                  <div className="space-y-3 border-t border-slate-800/80 pt-6 mb-8 text-left">
                    {tier.features.map((feature, idx) => (
                      <div key={idx} className="flex items-center gap-3 text-xs sm:text-sm text-slate-300 font-medium">
                        <div className="h-4 w-4 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                          <Check className="h-3 w-3" />
                        </div>
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Button
                  asChild
                  className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                    tier.popular
                      ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30"
                      : "bg-slate-800 hover:bg-slate-700 text-slate-200"
                  }`}
                >
                  <Link href={`/signup?plan=${tier.id}`}>
                    {tier.cta}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

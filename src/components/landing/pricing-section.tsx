"use client";

import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function PricingSection() {
  const [isAnnual, setIsAnnual] = useState(true);

  const tiers = [
    {
      name: "Starter Agency",
      id: "starter",
      priceMonthly: "$49",
      priceAnnual: "$39",
      description:
        "Ideal for boutique agencies managing up to 10 Google Ads client accounts.",
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
      description:
        "For fast-growing agencies needing automated threat matrix & AI briefings.",
      features: [
        "Up to 50 Google Ads Accounts",
        "Threat Matrix Real-Time Scanner",
        "Turbo Negative Keyword Generator",
        "GoHighLevel Onboarding Pipeline",
        "Unlimited Landing Page Audits",
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
      description:
        "For enterprise agencies managing large MCC portfolios with custom branding.",
      features: [
        "Unlimited Google Ads Accounts",
        "Full Multi-Tenant White-Labeling",
        "Custom AI Model Prompts & Tuning",
        "Dedicated Database Isolation",
        "24/7 Slack / Teams VIP Support",
        "Custom API & Webhooks Access",
      ],
      cta: "Contact Enterprise",
      popular: false,
    },
  ];

  return (
    <section id="pricing" className="py-20 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Title - SOLID BLACK */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 mb-4">
            Transparent Agency Pricing. No Hidden Fees.
          </h2>
          <p className="text-base sm:text-lg text-slate-600 font-normal">
            Choose the plan that fits your agency MCC portfolio size. Scale up
            or down anytime.
          </p>

          {/* Monthly / Annual Billing Toggle */}
          <div className="flex items-center justify-center gap-4 mt-8">
            <span
              className={`text-sm font-semibold ${
                !isAnnual ? "text-slate-900" : "text-slate-500"
              }`}
            >
              Monthly Billing
            </span>
            <button
              type="button"
              onClick={() => setIsAnnual(!isAnnual)}
              className="relative w-14 h-8 bg-slate-200 rounded-full p-1 transition-colors duration-200 focus:outline-none"
            >
              <div
                className={`w-6 h-6 bg-black rounded-full shadow-md transform transition-transform duration-200 ${
                  isAnnual ? "translate-x-6" : "translate-x-0"
                }`}
              />
            </button>
            <span
              className={`text-sm font-semibold flex items-center gap-2 ${
                isAnnual ? "text-slate-900" : "text-slate-500"
              }`}
            >
              Annual Billing
              <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-0.5 rounded-md border border-emerald-200">
                Save 20%
              </span>
            </span>
          </div>
        </div>

        {/* Pricing Tier Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          {tiers.map((tier) => (
            <div
              key={tier.id}
              className={`bg-white rounded-2xl p-8 flex flex-col justify-between text-left relative transition-all ${
                tier.popular
                  ? "border-2 border-black shadow-lg"
                  : "border border-slate-200 shadow-sm hover:border-slate-300"
              }`}
            >
              {tier.popular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-black text-white text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                  Most Popular Agency Choice
                </div>
              )}

              <div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">
                  {tier.name}
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed mb-6 font-medium">
                  {tier.description}
                </p>

                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-extrabold text-slate-900">
                    {isAnnual ? tier.priceAnnual : tier.priceMonthly}
                  </span>
                  <span className="text-sm font-semibold text-slate-500">
                    / month {isAnnual && "(billed annually)"}
                  </span>
                </div>

                <div className="space-y-3 mb-8 border-t border-slate-100 pt-6">
                  {tier.features.map((feature, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 text-xs sm:text-sm text-slate-800 font-medium"
                    >
                      <Check className="h-4 w-4 text-slate-900 shrink-0" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Button
                asChild
                className={`w-full py-6 rounded-lg font-bold text-sm transition-all ${
                  tier.popular
                    ? "bg-black text-white hover:bg-slate-800 shadow-sm"
                    : "bg-slate-100 text-slate-900 hover:bg-slate-200 border border-slate-200"
                }`}
              >
                <Link
                  href="/signup"
                  className="flex items-center justify-center gap-2"
                >
                  {tier.cta}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

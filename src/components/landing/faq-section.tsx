"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      q: "How does Uprise Tools connect to our Google Ads MCC portfolio?",
      a: "Uprise Tools uses official Google Ads API OAuth 2.0. In Step 2 of our onboarding wizard, your agency admin logs in with your Google MCC credentials. We automatically fetch all active customer sub-accounts without needing developer tokens or manual CSV exports.",
    },
    {
      q: "Are client executive AI morning briefings customizable?",
      a: "Yes! You can configure specific AI prompts, delivery schedules (e.g., 7:00 AM daily), white-label branding, and client email recipient routing per account.",
    },
    {
      q: "How does the Threat Matrix detect wasted ad spend?",
      a: "Our background anomaly engine evaluates hourly performance metrics against historical baselines. It flags sudden CPC spikes, zero-conversion spend burns, broken landing page URLs, and impression share losses in real time.",
    },
    {
      q: "Can we manage multi-tenant permissions for different team members?",
      a: "Absoluty. Uprise Tools enforces database PostgreSQL Row-Level Security (RLS). You can invite account managers, media buyers, and agency executives with granular role-based access control.",
    },
    {
      q: "Is there a setup fee or contract commitment?",
      a: "No setup fees or long-term contracts. You start with a 14-day free trial, and you can upgrade, downgrade, or cancel anytime from your settings portal.",
    },
  ];

  return (
    <section className="py-20 bg-slate-50 border-b border-slate-200">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Title - SOLID BLACK */}
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-base text-slate-600 font-normal">
            Everything you need to know about our agency PPC command OS.
          </p>
        </div>

        {/* Accordion List */}
        <div className="space-y-4">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div
                key={index}
                className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm transition-all"
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="w-full p-6 text-left flex items-center justify-between gap-4 font-bold text-base text-slate-900 hover:text-black transition-colors"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    className={`h-5 w-5 text-slate-500 shrink-0 transition-transform duration-200 ${
                      isOpen ? "rotate-180 text-black" : ""
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-6 pb-6 text-sm text-slate-600 leading-relaxed font-normal border-t border-slate-100 pt-4">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

"use client";

import { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";

export function FAQSection() {
  const faqs = [
    {
      question: "How does Uprise Tools connect to my Google Ads accounts?",
      answer:
        "Uprise Tools uses official Google Ads API OAuth 2.0. You simply sign in with your Google account that has access to your Google Ads Manager (MCC) account. We only request read and standard campaign edit permissions required for audits and negative keyword updates.",
    },
    {
      question: "Can I customize the automated AI Morning Briefings?",
      answer:
        "Yes! You can specify recipient email addresses, dispatch times, target metrics, custom AI instructions, and white-label branding for each client organization.",
    },
    {
      question: "What happens if a client account has a spend anomaly?",
      answer:
        "The Google Ads Threat Matrix flags any abnormal spend spike or CPC increase immediately. Depending on your alert rule configuration, Uprise can send instant email alerts, execute automated negative keyword exclusions, or trigger webhooks to your team.",
    },
    {
      question: "Can I manage multiple agency client workspaces?",
      answer:
        "Absolutely. Uprise Tools is built with native multi-tenancy. You can create separate workspaces for each client or brand, invite team members with role-based access, and switch between orgs seamlessly.",
    },
    {
      question: "Is there a long-term contract or setup fee?",
      answer:
        "No long-term contracts! All plans come with a 14-day free trial, and you can change or cancel your subscription anytime directly from your dashboard billing settings.",
    },
  ];

  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <section className="py-20 relative bg-slate-950">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-400 text-xs font-semibold mb-3">
            <HelpCircle className="h-3.5 w-3.5 text-indigo-400" />
            <span>Got Questions?</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Frequently Asked Questions
          </h2>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, idx) => {
            const isOpen = openIdx === idx;
            return (
              <div
                key={idx}
                className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden transition-all"
              >
                <button
                  onClick={() => setOpenIdx(isOpen ? null : idx)}
                  className="w-full p-5 text-left flex items-center justify-between font-bold text-white text-sm sm:text-base gap-4"
                >
                  <span>{faq.question}</span>
                  <ChevronDown
                    className={`h-5 w-5 text-indigo-400 shrink-0 transition-transform ${
                      isOpen ? "rotate-180" : "rotate-0"
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 text-xs sm:text-sm text-slate-300 leading-relaxed border-t border-slate-800/40 pt-3">
                    {faq.answer}
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

"use client";

import { Clock, DollarSign, ShieldCheck, TrendingUp } from "lucide-react";

export function MetricsSection() {
  const metrics = [
    {
      icon: TrendingUp,
      value: "35%",
      label: "Avg CPA Reduction",
      subtext: "Achieved across search & Performance Max campaigns",
    },
    {
      icon: Clock,
      value: "15+ Hrs",
      label: "Saved per Specialist / Wk",
      subtext: "Automating reporting & manual negative keyword updates",
    },
    {
      icon: DollarSign,
      value: "$12M+",
      label: "Ad Spend Monitored",
      subtext: "Across hundreds of agency MCC sub-accounts globally",
    },
    {
      icon: ShieldCheck,
      value: "99.8%",
      label: "Threat Accuracy",
      subtext: "AI models catch spend spikes & broken tracking instantly",
    },
  ];

  return (
    <section className="py-16 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {metrics.map((item, index) => {
            const Icon = item.icon;
            return (
              <div
                key={index}
                className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-left relative overflow-hidden group hover:border-slate-300 transition-all shadow-sm"
              >
                <div className="h-10 w-10 rounded-lg bg-black text-white flex items-center justify-center mb-4 transition-transform group-hover:scale-105">
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <div className="text-3xl font-extrabold text-slate-900 tracking-tight mb-1">
                  {item.value}
                </div>
                <div className="text-sm font-bold text-slate-800 mb-1">
                  {item.label}
                </div>
                <div className="text-xs text-slate-600 leading-relaxed font-medium">
                  {item.subtext}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

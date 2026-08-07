"use client";

import { TrendingUp, Clock, DollarSign, ShieldCheck } from "lucide-react";

export function MetricsSection() {
  const metrics = [
    {
      icon: TrendingUp,
      value: "35%",
      label: "Avg CPA Reduction",
      subtext: "Achieved across search & Performance Max campaigns",
      color: "text-emerald-400",
      bg: "bg-emerald-500/10 border-emerald-500/20",
    },
    {
      icon: Clock,
      value: "15+ Hrs",
      label: "Saved per Specialist / Week",
      subtext: "Automating reporting & manual negative keyword updates",
      color: "text-indigo-400",
      bg: "bg-indigo-500/10 border-indigo-500/20",
    },
    {
      icon: DollarSign,
      value: "$12M+",
      label: "Google Ads Spend Monitored",
      subtext: "Across hundreds of agency MCC sub-accounts globally",
      color: "text-cyan-400",
      bg: "bg-cyan-500/10 border-cyan-500/20",
    },
    {
      icon: ShieldCheck,
      value: "99.8%",
      label: "Threat Detection Accuracy",
      subtext: "AI models catch spend spikes & broken tracking instantly",
      color: "text-violet-400",
      bg: "bg-violet-500/10 border-violet-500/20",
    },
  ];

  return (
    <section className="py-20 relative bg-slate-900/40 border-y border-slate-800/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {metrics.map((item, index) => {
            const Icon = item.icon;
            return (
              <div
                key={index}
                className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-6 text-left relative overflow-hidden group hover:border-slate-700 transition-all shadow-xl"
              >
                <div className={`h-12 w-12 rounded-xl ${item.bg} border flex items-center justify-center mb-4 transition-transform group-hover:scale-110`}>
                  <Icon className={`h-6 w-6 ${item.color}`} />
                </div>
                <div className="text-4xl font-black text-white tracking-tight mb-1">
                  {item.value}
                </div>
                <div className="text-sm font-bold text-slate-200 mb-1">
                  {item.label}
                </div>
                <div className="text-xs text-slate-400 leading-relaxed font-medium">
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

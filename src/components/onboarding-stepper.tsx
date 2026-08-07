"use client";

import { Check } from "lucide-react";

interface OnboardingStepperProps {
  currentStep: 1 | 2 | 3 | 4;
}

export function OnboardingStepper({ currentStep }: OnboardingStepperProps) {
  const steps = [
    { number: 1, label: "Workspace & Preferences" },
    { number: 2, label: "Connect Google Ads" },
    { number: 3, label: "Select Accounts" },
    { number: 4, label: "Ready & Sync" },
  ];

  return (
    <div className="w-full mb-8">
      <div className="flex items-center justify-between relative">
        {/* Connector Bar Background */}
        <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-800 -translate-y-1/2 z-0" />

        {steps.map((step) => {
          const isCompleted = step.number < currentStep;
          const isCurrent = step.number === currentStep;

          return (
            <div
              key={step.number}
              className="relative z-10 flex flex-col items-center group cursor-default"
            >
              <div
                className={`h-9 w-9 rounded-full flex items-center justify-center font-bold text-xs transition-all border ${
                  isCompleted
                    ? "bg-emerald-600 text-white border-emerald-400 shadow-md shadow-emerald-600/20"
                    : isCurrent
                      ? "bg-indigo-600 text-white border-indigo-400 ring-4 ring-indigo-500/20 shadow-lg shadow-indigo-600/30"
                      : "bg-slate-900 text-slate-500 border-slate-800"
                }`}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : step.number}
              </div>
              <span
                className={`text-[11px] font-semibold mt-2 hidden sm:block ${
                  isCurrent
                    ? "text-indigo-400"
                    : isCompleted
                      ? "text-slate-300"
                      : "text-slate-500"
                }`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import { Check } from "lucide-react";

interface OnboardingStepperProps {
  currentStep: 1 | 2 | 3 | 4;
}

export function OnboardingStepper({ currentStep }: OnboardingStepperProps) {
  const steps = [
    { number: 1, label: "Preferences" },
    { number: 2, label: "Connect Ads" },
    { number: 3, label: "Select MCC" },
    { number: 4, label: "Ready & Sync" },
  ];

  return (
    <div className="w-full mb-8">
      <div className="relative flex items-start justify-between">
        {/* Connector Line - anchored precisely to top 18px (center of 36px circle) */}
        <div className="absolute top-[18px] left-8 right-8 h-0.5 bg-slate-200 dark:bg-slate-800 z-0" />

        {steps.map((step) => {
          const isCompleted = step.number < currentStep;
          const isCurrent = step.number === currentStep;

          return (
            <div
              key={step.number}
              className="relative z-10 flex flex-col items-center group w-20 text-center cursor-default"
            >
              <div
                className={`h-9 w-9 rounded-full flex items-center justify-center font-bold text-xs transition-all border ${
                  isCompleted
                    ? "bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-600/20"
                    : isCurrent
                      ? "bg-indigo-600 text-white border-indigo-500 ring-4 ring-indigo-500/20 shadow-lg shadow-indigo-600/30"
                      : "bg-slate-100 dark:bg-slate-900 text-slate-400 dark:text-slate-500 border-slate-300 dark:border-slate-800"
                }`}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : step.number}
              </div>
              <span
                className={`text-[11px] font-semibold mt-2.5 leading-tight ${
                  isCurrent
                    ? "text-indigo-600 dark:text-indigo-400 font-bold"
                    : isCompleted
                      ? "text-slate-700 dark:text-slate-300"
                      : "text-slate-400 dark:text-slate-500"
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

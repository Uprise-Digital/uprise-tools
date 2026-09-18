import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function cleanCampaignNameToSearchTerm(campaignName: string): string {
  let cleaned = campaignName.toLowerCase();
  cleaned = cleaned.replace(/[|_\-[\]()]/g, " ");
  cleaned = cleaned
    .replace(
      /\b(campaign|search|broad|phrase|exact|ppc|pmax|leads|mcc|leads|client|competitor)\b/g,
      "",
    )
    .replace(
      /\b\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\b/g,
      "",
    )
    .replace(
      /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/g,
      "",
    )
    .replace(/\b\d{4}\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || "local services australia";
}


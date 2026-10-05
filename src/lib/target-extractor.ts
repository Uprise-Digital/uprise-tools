/**
 * target-extractor.ts
 *
 * Resilient parser that extracts target CPL / CPA and operational constraints
 * from unstructured freeform client notes, JSON-wrapped buyer personas, or settings notes.
 */

export interface ExtractedTargets {
  googleTargetCpa?: number;
  metaTargetCpa?: number;
  generalTargetCpa?: number;
  cleanNotes: string;
}

/**
 * Extracts raw readable text notes from either a plain string or JSON-wrapped persona object.
 */
export function extractCleanNotesText(
  rawNotes: string | null | undefined,
): string {
  if (!rawNotes || typeof rawNotes !== "string") return "";
  const trimmed = rawNotes.trim();
  if (!trimmed) return "";

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === "object" && parsed !== null) {
        if (typeof parsed.notes === "string") return parsed.notes.trim();
        if (typeof parsed.rawNotes === "string") return parsed.rawNotes.trim();
        if (typeof parsed.targetBuyer === "string")
          return parsed.targetBuyer.trim();
      }
    } catch {
      // Fallback to raw string
    }
  }

  return trimmed;
}

/**
 * Parses freeform notes for target CPL/CPA numbers, detecting platform specificity (Google vs Meta)
 * as well as general target declarations.
 *
 * Supported Patterns:
 * - "Google ads - $450 for now" -> google: 450
 * - "Google: $450, Meta: $120" -> google: 450, meta: 120
 * - "Target CPL: $350" -> general: 350
 * - "CPA target $150" -> general: 150
 * - "Target CPL is $450" -> general: 450
 * - "$450 target" -> general: 450
 */
export function extractTargetsFromNotes(
  rawNotes: string | null | undefined,
): ExtractedTargets {
  const cleanNotes = extractCleanNotesText(rawNotes);
  if (!cleanNotes) {
    return { cleanNotes: "" };
  }

  let googleTargetCpa: number | undefined;
  let metaTargetCpa: number | undefined;
  let generalTargetCpa: number | undefined;

  // 1. Google Ads specific patterns
  // Examples: "Google ads - $450 for now", "Google: $450", "GAds target $450", "$450 for google"
  const googlePattern1 =
    /(?:google(?:\s*ads)?|gads|search)\s*(?:-|:|=|\sis\s|\sat\s)?\s*\$?([0-9]+(?:\.[0-9]{1,2})?)/i;
  const googlePattern2 =
    /\$?([0-9]+(?:\.[0-9]{1,2})?)\s*(?:cpl|cpa|target)?\s*(?:for\s*|on\s*)?(?:google|gads)/i;

  const gMatch1 = cleanNotes.match(googlePattern1);
  const gMatch2 = cleanNotes.match(googlePattern2);
  if (gMatch1?.[1]) {
    googleTargetCpa = parseFloat(gMatch1[1]);
  } else if (gMatch2?.[1]) {
    googleTargetCpa = parseFloat(gMatch2[1]);
  }

  // 2. Meta Ads specific patterns
  // Examples: "Meta ads - $120", "Meta: $120", "Facebook target $100", "FB - $95"
  const metaPattern1 =
    /(?:meta(?:\s*ads)?|facebook|fb|instagram|ig)\s*(?:-|:|=|\sis\s|\sat\s)?\s*\$?([0-9]+(?:\.[0-9]{1,2})?)/i;
  const metaPattern2 =
    /\$?([0-9]+(?:\.[0-9]{1,2})?)\s*(?:cpl|cpa|target)?\s*(?:for\s*|on\s*)?(?:meta|facebook|fb)/i;

  const mMatch1 = cleanNotes.match(metaPattern1);
  const mMatch2 = cleanNotes.match(metaPattern2);
  if (mMatch1?.[1]) {
    metaTargetCpa = parseFloat(mMatch1[1]);
  } else if (mMatch2?.[1]) {
    metaTargetCpa = parseFloat(mMatch2[1]);
  }

  // 3. General Target CPL / CPA patterns
  // Examples: "Target CPL: $450", "CPA target $350", "Cost per lead $450", "Target is $450", "$450 for now"
  const generalPattern1 =
    /(?:target\s*)?(?:cpl|cpa|cost per (?:lead|acquisition|conversion))\s*(?:is|:|-|=|\sat\s|\sof\s)?\s*\$?([0-9]+(?:\.[0-9]{1,2})?)/i;
  const generalPattern2 =
    /(?:target|goal|agreed cpl)\s*(?:is|:|-|=|\sat\s)?\s*\$([0-9]+(?:\.[0-9]{1,2})?)/i;
  const generalPattern3 =
    /\$([0-9]+(?:\.[0-9]{1,2})?)\s*(?:cpl|cpa|target|for now)/i;

  const genMatch1 = cleanNotes.match(generalPattern1);
  const genMatch2 = cleanNotes.match(generalPattern2);
  const genMatch3 = cleanNotes.match(generalPattern3);

  if (genMatch1?.[1]) {
    generalTargetCpa = parseFloat(genMatch1[1]);
  } else if (genMatch2?.[1]) {
    generalTargetCpa = parseFloat(genMatch2[1]);
  } else if (genMatch3?.[1]) {
    generalTargetCpa = parseFloat(genMatch3[1]);
  }

  // If google target was found and no general target was specified, google target also serves as candidate
  if (!generalTargetCpa && googleTargetCpa) {
    generalTargetCpa = googleTargetCpa;
  } else if (!generalTargetCpa && metaTargetCpa) {
    generalTargetCpa = metaTargetCpa;
  }

  return {
    googleTargetCpa,
    metaTargetCpa,
    generalTargetCpa,
    cleanNotes,
  };
}

/**
 * Resolves the effective target CPA for an account, respecting the explicit column first,
 * then falling back to parsed notes, then to the system default ($150).
 */
export function getEffectiveAccountTargetCpa(account: {
  targetCpa?: string | number | null;
  targetNotes?: string | null;
  channel?: "google" | "meta" | "blended";
}): {
  effectiveCpa: number;
  isCustom: boolean;
  source:
    | "explicit"
    | "extracted_google"
    | "extracted_meta"
    | "extracted_general"
    | "default";
} {
  // 1. Explicit DB Column
  if (
    account.targetCpa !== null &&
    account.targetCpa !== undefined &&
    account.targetCpa !== ""
  ) {
    const num = Number(account.targetCpa);
    if (!Number.isNaN(num) && num > 0) {
      return {
        effectiveCpa: num,
        isCustom: true,
        source: "explicit",
      };
    }
  }

  // 2. Extracted from Freeform Notes
  if (account.targetNotes) {
    const extracted = extractTargetsFromNotes(account.targetNotes);
    const channel = account.channel || "google";

    if (channel === "meta" && extracted.metaTargetCpa) {
      return {
        effectiveCpa: extracted.metaTargetCpa,
        isCustom: true,
        source: "extracted_meta",
      };
    }

    if (
      (channel === "google" || channel === "blended") &&
      extracted.googleTargetCpa
    ) {
      return {
        effectiveCpa: extracted.googleTargetCpa,
        isCustom: true,
        source: "extracted_google",
      };
    }

    if (extracted.generalTargetCpa) {
      return {
        effectiveCpa: extracted.generalTargetCpa,
        isCustom: true,
        source: "extracted_general",
      };
    }
  }

  // 3. Fallback agency default
  return {
    effectiveCpa: 150,
    isCustom: false,
    source: "default",
  };
}

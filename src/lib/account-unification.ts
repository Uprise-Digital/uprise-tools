export interface BaseAdAccount {
  id: number;
  googleAccountId: string;
  name: string;
  currencyCode: string | null;
  isActive: boolean;
  googleStatus: string;
  industry?: string | null;
  subNiche?: string | null;
  reportSchedules?: any[];
  emailLogs?: any[];
  createdAt?: Date | string | null;
}

export interface BaseMetaAdAccount {
  id: number;
  metaAccountId: string;
  name: string;
  currencyCode: string | null;
  timeZone: string | null;
  isActive: boolean;
  accountStatus: number;
  lastSyncedAt?: Date | string | null;
  syncStatus?: string | null;
  syncError?: string | null;
  targetCpa?: string | null;
  targetRoas?: string | null;
  monthlyBudgetCap?: string | null;
  industry?: string | null;
  subNiche?: string | null;
  createdAt?: Date | string | null;
}

export interface UnifiedAccountRow {
  // Unique composite key for table row
  key: string;
  name: string;
  platforms: ("google" | "meta")[];

  // Primary platform reference (for detail routes / actions)
  primaryId: number;
  primaryPlatform: "google" | "meta";

  // Google Ads details (if available)
  googleId?: number;
  googleAccountId?: string;
  googleStatus?: string;
  industry?: string | null;
  subNiche?: string | null;
  reportSchedules?: any[];
  emailLogs?: any[];

  // Meta Ads details (if available)
  metaId?: number;
  metaAccountId?: string;
  metaAccountStatus?: number;
  metaTimeZone?: string | null;

  // General attributes
  currencyCode: string | null;
  isActive: boolean;
}

/**
 * Normalizes an ad account name to facilitate cross-platform matching.
 * Handles case, punctuation, whitespace, and common legal/channel suffixes.
 */
export function normalizeAccountName(name: string): string {
  if (!name) return "";

  return (
    name
      .toLowerCase()
      // Remove common suffixes like "ad account", "ads", "google ads", "meta", "facebook"
      .replace(
        /\b(ad\s*account|ads|google\s*ads?|meta\s*ads?|fb\s*ads?|facebook\s*ads?)\b/gi,
        "",
      )
      // Remove company type suffixes
      .replace(/\b(pty\s*ltd|ltd|inc|pty|llc|gmbh|co|corp|corporation)\b/gi, "")
      // Strip special characters except alphanumeric
      .replace(/[^a-z0-9]/g, "")
      .trim()
  );
}

/**
 * Merges Google Ads accounts and Meta Ads accounts into a unified list.
 * Dual-platform accounts are merged into a single row with platforms: ["google", "meta"].
 * Google-only accounts have platforms: ["google"].
 * Meta-only accounts have platforms: ["meta"].
 */
export function unifyAccounts(
  googleAccounts: BaseAdAccount[],
  metaAccounts: BaseMetaAdAccount[],
): UnifiedAccountRow[] {
  const unifiedList: UnifiedAccountRow[] = [];
  const matchedMetaIds = new Set<number>();

  // 1. Index Meta accounts by normalized name
  const metaByNameMap = new Map<string, BaseMetaAdAccount[]>();
  for (const meta of metaAccounts) {
    const norm = normalizeAccountName(meta.name);
    if (norm) {
      const existing = metaByNameMap.get(norm) || [];
      existing.push(meta);
      metaByNameMap.set(norm, existing);
    }
  }

  // 2. Iterate Google accounts and look for matches
  for (const gAcc of googleAccounts) {
    const normName = normalizeAccountName(gAcc.name);
    const metaMatches = normName ? metaByNameMap.get(normName) : undefined;
    // Find first unused Meta match
    const metaMatch = metaMatches?.find((m) => !matchedMetaIds.has(m.id));

    if (metaMatch) {
      matchedMetaIds.add(metaMatch.id);
      unifiedList.push({
        key: `blended-${gAcc.id}-${metaMatch.id}`,
        name: gAcc.name, // prefer Google name or display name
        platforms: ["google", "meta"],
        primaryId: gAcc.id,
        primaryPlatform: "google",
        googleId: gAcc.id,
        googleAccountId: gAcc.googleAccountId,
        googleStatus: gAcc.googleStatus,
        industry:
          gAcc.industry && gAcc.industry !== "OTHER"
            ? gAcc.industry
            : metaMatch.industry || gAcc.industry || "OTHER",
        subNiche: gAcc.subNiche || metaMatch.subNiche || null,
        reportSchedules: gAcc.reportSchedules || [],
        emailLogs: gAcc.emailLogs || [],
        metaId: metaMatch.id,
        metaAccountId: metaMatch.metaAccountId,
        metaAccountStatus: metaMatch.accountStatus,
        metaTimeZone: metaMatch.timeZone,
        currencyCode: gAcc.currencyCode || metaMatch.currencyCode || "AUD",
        isActive: gAcc.isActive || metaMatch.isActive,
      });
    } else {
      // Google-only
      unifiedList.push({
        key: `google-${gAcc.id}`,
        name: gAcc.name,
        platforms: ["google"],
        primaryId: gAcc.id,
        primaryPlatform: "google",
        googleId: gAcc.id,
        googleAccountId: gAcc.googleAccountId,
        googleStatus: gAcc.googleStatus,
        industry: gAcc.industry || "OTHER",
        subNiche: gAcc.subNiche,
        reportSchedules: gAcc.reportSchedules || [],
        emailLogs: gAcc.emailLogs || [],
        currencyCode: gAcc.currencyCode || "AUD",
        isActive: gAcc.isActive,
      });
    }
  }

  // 3. Append remaining Meta-only accounts
  for (const meta of metaAccounts) {
    if (!matchedMetaIds.has(meta.id)) {
      unifiedList.push({
        key: `meta-${meta.id}`,
        name: meta.name,
        platforms: ["meta"],
        primaryId: meta.id,
        primaryPlatform: "meta",
        metaId: meta.id,
        metaAccountId: meta.metaAccountId,
        metaAccountStatus: meta.accountStatus,
        metaTimeZone: meta.timeZone,
        industry: meta.industry || "OTHER",
        subNiche: meta.subNiche || null,
        currencyCode: meta.currencyCode || "USD",
        isActive: meta.isActive,
      });
    }
  }

  return unifiedList;
}

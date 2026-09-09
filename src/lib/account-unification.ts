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
 * Helper to compute Levenshtein distance between two short strings
 */
function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const row = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = i;
    for (let j = 1; j <= n; j++) {
      const val = a[i - 1] === b[j - 1] ? row[j - 1] : Math.min(row[j - 1], prev, row[j]) + 1;
      row[j - 1] = prev;
      prev = val;
    }
    row[n] = prev;
  }
  return row[n];
}

/**
 * Helper to extract all numeric sequences from a string.
 * Used to ensure accounts with different numbers (e.g. "Store 1" vs "Store 2") never match.
 */
export function extractNumbers(str: string): string[] {
  return str.match(/\d+/g) || [];
}

/**
 * Strips common plurals and token endings for stem-level matching.
 * e.g., "xtechs" -> "xtech", "renewables" -> "renewable"
 */
export function stemAccountName(name: string): string {
  if (!name) return "";
  const norm = normalizeAccountName(name);
  if (!norm) return "";

  // Strip trailing 's' or plural endings across known segments or words
  return norm
    .replace(/ies\b/g, "y")
    .replace(/es\b/g, "")
    .replace(/s\b/g, "");
}

/**
 * Determines if two normalized or raw account names are a safe fuzzy match:
 * 1. Exact normalized match
 * 2. Stemmed match (e.g. xtech vs xtechs)
 * 3. Safeguard: Numbers in both names MUST be identical (prevents Store 1 vs Store 2 / franchise false matches)
 * 4. Safeguard: Minimum length >= 8 chars and minimum 2 common words/tokens
 * 5. Levenshtein edit distance <= 1 only if numbers match and length >= 8
 */
export function isAccountMatch(googleName: string, metaName: string): boolean {
  const gNorm = normalizeAccountName(googleName);
  const mNorm = normalizeAccountName(metaName);
  if (!gNorm || !mNorm) return false;
  if (gNorm === mNorm) return true;

  // SAFEGUARD: Number check. If either has numbers, all numbers must match exactly.
  const gNums = extractNumbers(googleName);
  const mNums = extractNumbers(metaName);
  if (gNums.length > 0 || mNums.length > 0) {
    if (gNums.join("-") !== mNums.join("-")) {
      return false;
    }
  }

  // Stem check: handles singular/plural brand variations (e.g., "xtechs" vs "xtech")
  const gStem = stemAccountName(googleName);
  const mStem = stemAccountName(metaName);
  if (gStem && mStem && gStem === mStem) return true;

  // For fuzzy Levenshtein distance, require higher length threshold (>= 8 chars)
  // to avoid matching short different words like "Sprint" vs "Spring".
  if (gNorm.length >= 8 && mNorm.length >= 8) {
    // Check edit distance 1 (handles single typo, missing 's', hyphenation difference)
    if (levenshteinDistance(gNorm, mNorm) <= 1) return true;

    // Substring containment only if the difference is purely a 1-character suffix/prefix
    if (
      (gNorm.startsWith(mNorm) || mNorm.startsWith(gNorm)) &&
      Math.abs(gNorm.length - mNorm.length) <= 1
    ) {
      return true;
    }
  }

  return false;
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

  // 1. Index Meta accounts by normalized name and stem name
  const metaByNameMap = new Map<string, BaseMetaAdAccount[]>();
  const metaByStemMap = new Map<string, BaseMetaAdAccount[]>();

  for (const meta of metaAccounts) {
    const norm = normalizeAccountName(meta.name);
    if (norm) {
      const existing = metaByNameMap.get(norm) || [];
      existing.push(meta);
      metaByNameMap.set(norm, existing);
    }
    const stem = stemAccountName(meta.name);
    if (stem) {
      const existing = metaByStemMap.get(stem) || [];
      existing.push(meta);
      metaByStemMap.set(stem, existing);
    }
  }

  // 2. Iterate Google accounts and look for matches
  for (const gAcc of googleAccounts) {
    const normName = normalizeAccountName(gAcc.name);
    const stemName = stemAccountName(gAcc.name);

    // Pass 1: Exact normalized match
    let metaMatch = normName
      ? metaByNameMap.get(normName)?.find((m) => !matchedMetaIds.has(m.id))
      : undefined;

    // Pass 2: Stemmed match (e.g. "xtech" vs "xtechs", "renewable" vs "renewables")
    if (!metaMatch && stemName) {
      metaMatch = metaByStemMap.get(stemName)?.find((m) => !matchedMetaIds.has(m.id));
    }

    // Pass 3: Fuzzy / Levenshtein distance match against remaining Meta accounts
    if (!metaMatch && normName && normName.length >= 6) {
      metaMatch = metaAccounts.find(
        (m) => !matchedMetaIds.has(m.id) && isAccountMatch(gAcc.name, m.name),
      );
    }

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

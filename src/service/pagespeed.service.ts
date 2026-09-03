export interface PageSpeedOpportunityItem {
  url?: string;
  totalBytes?: number;
  wastedBytes?: number;
  wastedMs?: number;
  node?: string;
}

export interface PageSpeedOpportunity {
  id: string;
  title: string;
  description: string;
  displayValue?: string;
  score?: number;
  wastedMs?: number;
  wastedBytes?: number;
  items?: PageSpeedOpportunityItem[];
}

export interface PageSpeedDiagnostics {
  totalBytes: number;
  jsBytes: number;
  imageBytes: number;
  cssBytes: number;
  fontBytes: number;
  htmlBytes: number;
  otherBytes: number;
  thirdPartyBytes: number;
  domElements?: number;
  mainThreadTimeMs?: number;
}

export interface PageSpeedCruxData {
  overallCategory?: string;
  lcp?: { percentile: number; category: string };
  cls?: { percentile: number; category: string };
  inp?: { percentile: number; category: string };
  fcp?: { percentile: number; category: string };
}

export interface PageSpeedAuditResult {
  url: string;
  device: "mobile" | "desktop";
  performanceScore: number; // 0 - 100
  accessibilityScore?: number;
  bestPracticesScore?: number;
  seoScore?: number;
  lcpMs: number;
  lcpDisplay: string;
  clsScore: number;
  clsDisplay: string;
  inpMs: number;
  inpDisplay: string;
  fcpMs: number;
  fcpDisplay: string;
  ttfbMs: number;
  ttfbDisplay: string;
  speedIndexMs: number;
  speedIndexDisplay: string;
  totalByteWeight: number;
  opportunities: PageSpeedOpportunity[];
  diagnostics: PageSpeedDiagnostics;
  cruxData?: PageSpeedCruxData;
  rawMetrics?: Record<string, any>;
}

/**
 * Executes a full Google PageSpeed Insights audit for a target URL
 */
export async function runPageSpeedAudit(
  targetUrl: string,
  device: "mobile" | "desktop" = "mobile",
): Promise<PageSpeedAuditResult> {
  // Ensure valid URL
  let validUrl = targetUrl.trim();
  if (!validUrl.startsWith("http://") && !validUrl.startsWith("https://")) {
    validUrl = `https://${validUrl}`;
  }

  const apiKey =
    process.env.PAGESPEED_API_KEY ||
    process.env.GOOGLE_PAGESPEED_API_KEY ||
    process.env.GOOGLE_API_KEY;

  const urlObj = new URL(
    "https://www.googleapis.com/pagespeedonline/v5/runPagespeed",
  );
  urlObj.searchParams.set("url", validUrl);
  urlObj.searchParams.set("strategy", device);
  urlObj.searchParams.append("category", "PERFORMANCE");
  urlObj.searchParams.append("category", "ACCESSIBILITY");
  urlObj.searchParams.append("category", "BEST_PRACTICES");
  urlObj.searchParams.append("category", "SEO");

  if (apiKey) {
    urlObj.searchParams.set("key", apiKey);
  }

  console.log(
    `[PageSpeed Service] Auditing ${validUrl} (${device.toUpperCase()})...`,
  );

  const response = await fetch(urlObj.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(
      `[PageSpeed Service Error] ${response.status} ${response.statusText}:`,
      errorBody,
    );
    throw new Error(
      `PageSpeed Insights API request failed (${response.status}): ${response.statusText}`,
    );
  }

  const data = await response.json();
  const lighthouse = data.lighthouseResult;
  if (!lighthouse) {
    throw new Error("Invalid response format from PageSpeed Insights API");
  }

  // 1. Extract category scores (0-1 -> 0-100)
  const categories = lighthouse.categories || {};
  const performanceScore = Math.round(
    (categories.performance?.score ?? 0) * 100,
  );
  const accessibilityScore = categories.accessibility?.score
    ? Math.round(categories.accessibility.score * 100)
    : undefined;
  const bestPracticesScore = categories["best-practices"]?.score
    ? Math.round(categories["best-practices"].score * 100)
    : undefined;
  const seoScore = categories.seo?.score
    ? Math.round(categories.seo.score * 100)
    : undefined;

  // 2. Extract Core Web Vitals & key audits
  const audits = lighthouse.audits || {};

  const lcpAudit = audits["largest-contentful-paint"] || {};
  const lcpMs = Math.round(lcpAudit.numericValue ?? 0);
  const lcpDisplay = lcpAudit.displayValue || `${(lcpMs / 1000).toFixed(1)} s`;

  const clsAudit = audits["cumulative-layout-shift"] || {};
  const clsScore = Number((clsAudit.numericValue ?? 0).toFixed(3));
  const clsDisplay = clsAudit.displayValue || clsScore.toString();

  // INP (Interaction to Next Paint) or fallback to Total Blocking Time (TBT)
  const inpAudit =
    audits["interaction-to-next-paint"] ||
    audits["total-blocking-time"] ||
    audits["max-potential-fid"] ||
    {};
  const inpMs = Math.round(inpAudit.numericValue ?? 0);
  const inpDisplay = inpAudit.displayValue || `${inpMs} ms`;

  const fcpAudit = audits["first-contentful-paint"] || {};
  const fcpMs = Math.round(fcpAudit.numericValue ?? 0);
  const fcpDisplay = fcpAudit.displayValue || `${(fcpMs / 1000).toFixed(1)} s`;

  const ttfbAudit = audits["server-response-time"] || {};
  const ttfbMs = Math.round(ttfbAudit.numericValue ?? 0);
  const ttfbDisplay =
    ttfbAudit.displayValue ||
    (ttfbMs > 1000 ? `${(ttfbMs / 1000).toFixed(2)} s` : `${ttfbMs} ms`);

  const speedIndexAudit = audits["speed-index"] || {};
  const speedIndexMs = Math.round(speedIndexAudit.numericValue ?? 0);
  const speedIndexDisplay =
    speedIndexAudit.displayValue || `${(speedIndexMs / 1000).toFixed(1)} s`;

  const totalByteWeight = Math.round(
    audits["total-byte-weight"]?.numericValue ?? 0,
  );

  // 3. Extract High Impact Opportunities
  const opportunityAuditKeys = [
    "render-blocking-resources",
    "unused-javascript",
    "unused-css-rules",
    "modern-image-formats",
    "uses-optimized-images",
    "offscreen-images",
    "uses-responsive-images",
    "unminified-javascript",
    "unminified-css",
    "efficient-animated-content",
    "duplicated-javascript",
    "legacy-javascript",
    "redirects",
    "uses-text-compression",
    "server-response-time",
  ];

  const opportunities: PageSpeedOpportunity[] = [];
  for (const key of opportunityAuditKeys) {
    const item = audits[key];
    if (item && item.score !== null && item.score !== undefined && item.score < 0.9) {
      const wastedMs = item.details?.overallSavingsMs
        ? Math.round(item.details.overallSavingsMs)
        : undefined;
      const wastedBytes = item.details?.overallSavingsBytes
        ? Math.round(item.details.overallSavingsBytes)
        : undefined;

      // Extract specific offending items (up to top 5)
      const subItems: PageSpeedOpportunityItem[] = [];
      if (item.details?.items && Array.isArray(item.details.items)) {
        for (const rawSub of item.details.items.slice(0, 5)) {
          subItems.push({
            url: typeof rawSub.url === "string" ? rawSub.url : undefined,
            totalBytes: rawSub.totalBytes,
            wastedBytes: rawSub.wastedBytes,
            wastedMs: rawSub.wastedMs,
            node: rawSub.node?.snippet || rawSub.node?.selector,
          });
        }
      }

      opportunities.push({
        id: item.id || key,
        title: item.title || key,
        description: item.description || "",
        displayValue: item.displayValue,
        score: item.score,
        wastedMs,
        wastedBytes,
        items: subItems.length > 0 ? subItems : undefined,
      });
    }
  }

  // Sort opportunities by largest estimated time savings or byte savings
  opportunities.sort((a, b) => {
    const aMs = a.wastedMs ?? 0;
    const bMs = b.wastedMs ?? 0;
    if (aMs !== bMs) return bMs - aMs;
    return (b.wastedBytes ?? 0) - (a.wastedBytes ?? 0);
  });

  // 4. Extract Resource Breakdown from resource-summary audit
  const resSummary = audits["resource-summary"]?.details?.items || [];
  let jsBytes = 0;
  let imageBytes = 0;
  let cssBytes = 0;
  let fontBytes = 0;
  let htmlBytes = 0;
  let otherBytes = 0;
  let totalBytes = totalByteWeight;
  let thirdPartyBytes = 0;

  for (const r of resSummary) {
    const size = r.transferSize || r.size || 0;
    switch (r.resourceType) {
      case "script":
        jsBytes = size;
        break;
      case "image":
        imageBytes = size;
        break;
      case "stylesheet":
        cssBytes = size;
        break;
      case "font":
        fontBytes = size;
        break;
      case "document":
        htmlBytes = size;
        break;
      case "total":
        totalBytes = size || totalByteWeight;
        break;
      case "third-party":
        thirdPartyBytes = size;
        break;
      default:
        otherBytes += size;
        break;
    }
  }

  const domElements = audits["dom-size"]?.numericValue;
  const mainThreadTimeMs = audits["mainthread-work-breakdown"]?.numericValue;

  const diagnostics: PageSpeedDiagnostics = {
    totalBytes,
    jsBytes,
    imageBytes,
    cssBytes,
    fontBytes,
    htmlBytes,
    otherBytes,
    thirdPartyBytes,
    domElements: domElements ? Math.round(domElements) : undefined,
    mainThreadTimeMs: mainThreadTimeMs ? Math.round(mainThreadTimeMs) : undefined,
  };

  // 5. Extract CrUX field user data if present
  let cruxData: PageSpeedCruxData | undefined;
  const loadingExp = data.loadingExperience;
  if (loadingExp && loadingExp.metrics) {
    const cruxMetrics = loadingExp.metrics;
    cruxData = {
      overallCategory: loadingExp.overall_category,
      lcp: cruxMetrics.LARGEST_CONTENTFUL_PAINT_MS
        ? {
            percentile: cruxMetrics.LARGEST_CONTENTFUL_PAINT_MS.percentile,
            category: cruxMetrics.LARGEST_CONTENTFUL_PAINT_MS.category,
          }
        : undefined,
      cls: cruxMetrics.CUMULATIVE_LAYOUT_SHIFT_SCORE
        ? {
            percentile:
              cruxMetrics.CUMULATIVE_LAYOUT_SHIFT_SCORE.percentile / 100,
            category: cruxMetrics.CUMULATIVE_LAYOUT_SHIFT_SCORE.category,
          }
        : undefined,
      inp: cruxMetrics.INTERACTION_TO_NEXT_PAINT
        ? {
            percentile: cruxMetrics.INTERACTION_TO_NEXT_PAINT.percentile,
            category: cruxMetrics.INTERACTION_TO_NEXT_PAINT.category,
          }
        : undefined,
      fcp: cruxMetrics.FIRST_CONTENTFUL_PAINT_MS
        ? {
            percentile: cruxMetrics.FIRST_CONTENTFUL_PAINT_MS.percentile,
            category: cruxMetrics.FIRST_CONTENTFUL_PAINT_MS.category,
          }
        : undefined,
    };
  }

  return {
    url: validUrl,
    device,
    performanceScore,
    accessibilityScore,
    bestPracticesScore,
    seoScore,
    lcpMs,
    lcpDisplay,
    clsScore,
    clsDisplay,
    inpMs,
    inpDisplay,
    fcpMs,
    fcpDisplay,
    ttfbMs,
    ttfbDisplay,
    speedIndexMs,
    speedIndexDisplay,
    totalByteWeight: totalBytes,
    opportunities,
    diagnostics,
    cruxData,
  };
}

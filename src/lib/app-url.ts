/**
 * Dynamically resolves the current base application URL for both server and client execution environments.
 *
 * Evaluation Order:
 * 1. Client window.location.origin (if running in browser and not localhost)
 * 2. process.env.PRODUCTION_APP_URL
 * 3. Canonical production domain: https://tools.uprisedigital.com.au
 * 4. Railway deployment auto-domain (process.env.RAILWAY_PUBLIC_DOMAIN)
 * 5. process.env.NEXT_PUBLIC_APP_URL (if non-localhost)
 * 6. process.env.BETTER_AUTH_URL (if non-localhost)
 */
export const CANONICAL_APP_URL = "https://tools.uprisedigital.com.au";

export function getAppUrl(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    const origin = window.location.origin;
    if (!origin.includes("localhost")) {
      return origin;
    }
  }

  // 1. Explicit app URL override (custom instances, test stubs, etc.)
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
  }

  // 2. Fallback to custom Railway domain if explicitly set (except default uprise-tools domain where canonical takes precedence)
  const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN;
  if (railwayDomain) {
    if (railwayDomain.includes("uprise-tools")) {
      return CANONICAL_APP_URL;
    }
    return `https://${railwayDomain}`.replace(/\/+$/, "");
  }

  // 3. Explicit production URL
  if (
    process.env.PRODUCTION_APP_URL &&
    !process.env.PRODUCTION_APP_URL.includes("localhost")
  ) {
    return process.env.PRODUCTION_APP_URL.replace(/\/+$/, "");
  }

  if (
    process.env.BETTER_AUTH_URL &&
    !process.env.BETTER_AUTH_URL.includes("localhost")
  ) {
    return process.env.BETTER_AUTH_URL.replace(/\/+$/, "");
  }

  return CANONICAL_APP_URL;
}

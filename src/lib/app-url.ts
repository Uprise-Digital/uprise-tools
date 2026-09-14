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

  const envProductionUrl = process.env.PRODUCTION_APP_URL;
  if (envProductionUrl && !envProductionUrl.includes("localhost")) {
    return envProductionUrl.replace(/\/+$/, "");
  }

  const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN;
  if (railwayDomain && !railwayDomain.includes("localhost")) {
    return `https://${railwayDomain}`.replace(/\/+$/, "");
  }

  const nextPublicUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (nextPublicUrl && !nextPublicUrl.includes("localhost")) {
    return nextPublicUrl.replace(/\/+$/, "");
  }

  const authUrl = process.env.BETTER_AUTH_URL;
  if (authUrl && !authUrl.includes("localhost")) {
    return authUrl.replace(/\/+$/, "");
  }

  return CANONICAL_APP_URL;
}

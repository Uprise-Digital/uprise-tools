/**
 * Dynamically resolves the current base application URL for both server and client execution environments.
 * 
 * Evaluation Order:
 * 1. Client window.location.origin (if running in browser)
 * 2. process.env.NEXT_PUBLIC_APP_URL
 * 3. process.env.BETTER_AUTH_URL
 * 4. Railway deployment auto-domain (process.env.RAILWAY_PUBLIC_DOMAIN)
 * 5. Fallback localhost:3000
 */
export function getAppUrl(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }

  const envUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.BETTER_AUTH_URL ||
    (process.env.RAILWAY_PUBLIC_DOMAIN
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
      : null);

  if (envUrl) {
    return envUrl.replace(/\/+$/, "");
  }

  return "http://localhost:3000";
}

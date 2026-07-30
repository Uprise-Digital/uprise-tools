/**
 * Centralized AI Model Configuration
 *
 * Reads model choices from environment variables:
 * - GEMINI_MODEL_LOW: Standard / fast model tier (defaults to "gemini-3.5-flash")
 * - GEMINI_MODEL_HIGH: High reasoning / complex model tier (defaults to "gemini-3.5-flash")
 */

export const GEMINI_MODEL_LOW =
  process.env.GEMINI_MODEL_LOW || "gemini-3.5-flash";

export const GEMINI_MODEL_HIGH =
  process.env.GEMINI_MODEL_HIGH || "gemini-3.5-flash";

/**
 * Helper to retrieve model string by tier ("low" | "high").
 * Defaults to GEMINI_MODEL_LOW.
 */
export function getAiModel(tier: "low" | "high" = "low"): string {
  return tier === "high" ? GEMINI_MODEL_HIGH : GEMINI_MODEL_LOW;
}

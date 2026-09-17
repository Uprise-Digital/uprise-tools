/**
 * Meta Ads utility functions for parsing and deduplicating insights and actions.
 */

/**
 * Deduplicates and calculates true business conversions from Meta Graph API actions array.
 *
 * Meta Graph API returns multiple overlapping action types for the exact same event
 * (e.g. `lead`, `onsite_conversion.lead_grouped`, `offsite_complete_registration_add_meta_leads`,
 * and page interaction events like `onsite_conversion.post_net_like` containing 'conversion').
 *
 * This function prioritizes canonical top-level lead metrics and sums valid business conversion events
 * while strictly ignoring post engagement actions.
 */
export function parseMetaActionsConv(actions?: any[]): number {
  if (!Array.isArray(actions) || actions.length === 0) return 0;

  const actionMap = new Map<string, number>();
  for (const a of actions) {
    if (a.action_type) {
      actionMap.set(a.action_type, parseInt(a.value || "0", 10));
    }
  }

  let total = 0;

  // 1. Leads: Prefer canonical top-level 'lead' or 'omni_lead'.
  // Fallback to onsite lead breakdown only if top-level 'lead' is missing to avoid duplicate counting.
  const leadVal = actionMap.get("lead") ?? actionMap.get("omni_lead");
  if (leadVal !== undefined) {
    total += leadVal;
  } else {
    const onsiteLead =
      actionMap.get("onsite_conversion.lead_grouped") ??
      actionMap.get("onsite_conversion.lead") ??
      actionMap.get("onsite_web_lead") ??
      0;
    total += onsiteLead;
  }

  // 2. Purchases
  const purchaseVal =
    actionMap.get("purchase") ?? actionMap.get("omni_purchase") ?? 0;
  total += purchaseVal;

  // 3. Complete Registration (only count if top-level 'lead' is not already present)
  if (leadVal === undefined) {
    const regVal =
      actionMap.get("complete_registration") ??
      actionMap.get("omni_complete_registration") ??
      0;
    total += regVal;
  }

  // 4. Other key direct business conversion actions
  total += actionMap.get("contact") ?? 0;
  total += actionMap.get("schedule") ?? 0;
  total += actionMap.get("submit_application") ?? 0;

  // 5. Custom Pixel Conversions (offsite_conversion.custom.<pixelId>)
  for (const [type, val] of actionMap.entries()) {
    if (type.startsWith("offsite_conversion.custom.")) {
      total += val;
    }
  }

  return total;
}

/**
 * EMAIL DISPATCH GUARD - ZERO-TOLERANCE EXTERNAL SEND SHIELD
 *
 * ABSOLUTE MANDATE:
 * Under NO circumstances may ANY email EVER be dispatched to an address
 * that is not an internal @uprisedigital.com.au domain email.
 *
 * Any external non-team recipient is immediately stripped and blocked.
 * If all recipients are external, delivery safely diverts exclusively to SAFE_AGENT_EMAIL.
 */

export const SAFE_AGENT_EMAIL = "seyone@uprisedigital.com.au";

/**
 * Automated email dispatch setting:
 * Default to false (paused) to prevent any scheduled cron from firing unless explicitly enabled.
 */
export const ALLOW_AUTOMATED_EMAILS = false;

export function isAutomatedSendingAllowed(): boolean {
  return ALLOW_AUTOMATED_EMAILS;
}

export interface SanitizedEmailDelivery {
  to: string[];
  cc: string[];
  bcc?: string[];
  subject: string;
  isOverridden: boolean;
  originalRecipientsSummary: string;
}

/**
 * Helper to identify internal agency domain team members.
 * ONLY emails ending in @uprisedigital.com.au or matching SAFE_AGENT_EMAIL are allowed.
 */
export function isTeamEmail(email: string): boolean {
  if (!email) return false;
  const normalized = email.toLowerCase().trim();
  return (
    normalized.endsWith("@uprisedigital.com.au") ||
    normalized === SAFE_AGENT_EMAIL.toLowerCase()
  );
}

/**
 * Enforces the zero-tolerance email firewall.
 * NON-UPRISEDIGITAL RECIPIENTS ARE NEVER PERMITTED. EVER.
 */
export function enforceEmailSafeguard(
  intendedTo: string | string[],
  intendedSubject: string,
  intendedCc?: string | string[],
  intendedBcc?: string | string[],
): SanitizedEmailDelivery {
  const toList = (Array.isArray(intendedTo) ? intendedTo : [intendedTo])
    .filter(Boolean)
    .map((e) => String(e).trim());
  const ccList = (
    Array.isArray(intendedCc) ? intendedCc : intendedCc ? [intendedCc] : []
  )
    .filter(Boolean)
    .map((e) => String(e).trim());
  const bccList = (
    Array.isArray(intendedBcc) ? intendedBcc : intendedBcc ? [intendedBcc] : []
  )
    .filter(Boolean)
    .map((e) => String(e).trim());

  const allRecipients = [...toList, ...ccList, ...bccList];
  const originalSummary = allRecipients.join(", ");

  // 1. Separate allowed internal team emails from external non-team emails
  const allowedTo = toList.filter(isTeamEmail);
  const allowedCc = ccList.filter(isTeamEmail);
  const allowedBcc = bccList.filter(isTeamEmail);

  const blockedRecipients = allRecipients.filter((e) => !isTeamEmail(e));

  // 2. If ANY external recipient was present, block them completely
  if (blockedRecipients.length > 0) {
    console.error(
      `🚨 [ZERO-TOLERANCE EMAIL GUARD] Blocked external non-team recipient(s): [${blockedRecipients.join(", ")}]. Intended subject: "${intendedSubject}". Diverting to internal team safely.`,
    );

    // If there are allowed team members in 'to', send only to them.
    // Otherwise, divert to SAFE_AGENT_EMAIL so internal team can review.
    const finalTo = allowedTo.length > 0 ? allowedTo : [SAFE_AGENT_EMAIL];

    return {
      to: finalTo,
      cc: allowedCc,
      bcc: allowedBcc,
      subject: `[EXTERNAL BLOCKED: ${blockedRecipients.join(", ")}] ${intendedSubject}`,
      isOverridden: true,
      originalRecipientsSummary: originalSummary,
    };
  }

  // 3. All recipients are verified internal @uprisedigital.com.au team members
  return {
    to: allowedTo.length > 0 ? allowedTo : [SAFE_AGENT_EMAIL],
    cc: allowedCc,
    bcc: allowedBcc,
    subject: intendedSubject,
    isOverridden: false,
    originalRecipientsSummary: originalSummary,
  };
}


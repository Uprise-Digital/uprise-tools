/**
 * EMAIL DISPATCH GUARD
 *
 * Outward sends and team emails are enabled.
 * Moratorium on outward sends has been lifted.
 */

export const SAFE_AGENT_EMAIL = "seyone@uprisedigital.com.au";

/**
 * Automated email dispatch setting:
 * When true, scheduled background cron jobs and report pipelines are active.
 */
export const ALLOW_AUTOMATED_EMAILS = true;

/**
 * Moratorium on outward sends:
 * Set to false so that sending to the team and outward recipients is enabled.
 */
export const OUTWARD_SENDS_MORATORIUM =
  process.env.ENABLE_OUTWARD_EMAILS === "false";

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
 */
export function isTeamEmail(email: string): boolean {
  const normalized = email.toLowerCase().trim();
  return (
    normalized.endsWith("@uprisedigital.com.au") ||
    normalized === SAFE_AGENT_EMAIL.toLowerCase()
  );
}

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

  // If moratorium is lifted, send directly to intended recipients
  if (!OUTWARD_SENDS_MORATORIUM) {
    return {
      to: toList.length > 0 ? toList : [SAFE_AGENT_EMAIL],
      cc: ccList,
      bcc: bccList,
      subject: intendedSubject,
      isOverridden: false,
      originalRecipientsSummary: originalSummary,
    };
  }

  // If moratorium was explicitly active, still permit any internal team member sends
  const hasExternalNonTeamRecipient = allRecipients.some(
    (e) => !isTeamEmail(e),
  );
  if (!hasExternalNonTeamRecipient) {
    return {
      to: toList,
      cc: ccList,
      bcc: bccList,
      subject: intendedSubject,
      isOverridden: false,
      originalRecipientsSummary: originalSummary,
    };
  }

  // Otherwise, divert to safe agent email with dev tag
  console.warn(
    `[EMAIL SAFEGUARD INTERCEPT] Moratorium active. Diverting [${originalSummary}] to ${SAFE_AGENT_EMAIL}`,
  );
  return {
    to: [SAFE_AGENT_EMAIL],
    cc: [],
    bcc: [],
    subject: `[TEST / DEV - Intended for: ${originalSummary}] ${intendedSubject}`,
    isOverridden: true,
    originalRecipientsSummary: originalSummary,
  };
}

/**
 * CRITICAL EMAIL DISPATCH GUARD
 * 
 * Strict agency policy: NEVER send emails to external clients.
 * For the time being, ALL emails across the entire platform are restricted exclusively 
 * to seyone@uprisedigital.com.au.
 */

export const SAFE_AGENT_EMAIL = "seyone@uprisedigital.com.au";

/**
 * STRICT AGENCY DIRECTIVE: NO EMAILS TO BE SENT THROUGH AUTOMATION.
 * When false, background cron jobs, schedulers, and automated workers are blocked from sending.
 * Only manual user actions in the dashboard UI (or test sends) can trigger dispatch.
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

export function enforceEmailSafeguard(
  intendedTo: string | string[],
  intendedSubject: string,
  intendedCc?: string | string[],
  intendedBcc?: string | string[]
): SanitizedEmailDelivery {
  const toList = (Array.isArray(intendedTo) ? intendedTo : [intendedTo])
    .filter(Boolean)
    .map((e) => String(e).trim());
  const ccList = (Array.isArray(intendedCc) ? intendedCc : (intendedCc ? [intendedCc] : []))
    .filter(Boolean)
    .map((e) => String(e).trim());
  const bccList = (Array.isArray(intendedBcc) ? intendedBcc : (intendedBcc ? [intendedBcc] : []))
    .filter(Boolean)
    .map((e) => String(e).trim());

  const allRecipients = [...toList, ...ccList, ...bccList];
  const hasExternalRecipient = allRecipients.some(
    (e) => e.toLowerCase() !== SAFE_AGENT_EMAIL.toLowerCase()
  );

  if (hasExternalRecipient) {
    const originalSummary = allRecipients.join(", ");
    console.warn(
      `[EMAIL SAFEGUARD INTERCEPT] Blocked sending to external recipients: [${originalSummary}]. Diverting strictly to ${SAFE_AGENT_EMAIL}`
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

  return {
    to: [SAFE_AGENT_EMAIL],
    cc: [],
    bcc: [],
    subject: intendedSubject,
    isOverridden: false,
    originalRecipientsSummary: SAFE_AGENT_EMAIL,
  };
}

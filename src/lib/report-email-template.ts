/**
 * UPRISE DIGITAL EXECUTIVE REPORT EMAIL TEMPLATE
 * Matches Lakshane Fonseka's 3-Pillar Executive Reporting Standard (Image 2 styling).
 * Clean plain-formatted text in 14px system font, zero corporate fluff, zero purple cards,
 * official Uprise signature footer with logo_black.png, and confidentiality notice.
 */
export function buildReportEmailHtml(data: {
  clientName: string;
  introText: string;
  metrics?: {
    conversions?: string | number;
    cost?: string | number;
    clicks?: string | number;
    ctr?: string | number;
    costPerConv?: string | number;
  };
  targetMonth?: string;
  reportUrl?: string;
  senderName?: string;
  senderRole?: string;
  senderPhone?: string;
  senderWebsite?: string;
}): string {
  const { clientName, introText, reportUrl } = data;
  const senderName = data.senderName || "Lakshane Fonseka";
  const senderRole = data.senderRole || "Founder | Uprise Digital";
  const senderPhone = data.senderPhone || "+61 426 759 756";
  const senderWebsite = data.senderWebsite || "www.uprisedigital.com.au";
  const cleanWebsite = senderWebsite.replace(/^https?:\/\//, "");

  // Linkify URLs into clean blue underline hyperlinks
  const linkify = (text: string) => {
    return text.replace(
      /(https?:\/\/[^\s<]+)/g,
      '<a href="$1" style="color: #1155cc; text-decoration: underline;" target="_blank" rel="noopener noreferrer">$1</a>',
    );
  };

  // Convert double newlines into clean paragraph spacing
  const rawParagraphs = (introText || "")
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const paragraphsHtml = rawParagraphs
    .map((p) => {
      const formatted = linkify(p).replace(/\n/g, "<br />");
      return `<p style="margin: 0 0 14px 0; line-height: 1.6; color: inherit;">${formatted}</p>`;
    })
    .join("\n    ");

  const reportLinkHtml = reportUrl
    ? `<p style="margin: 20px 0 10px 0; font-size: 15px; font-weight: bold;">
        <a href="${reportUrl}" style="color: #1155cc; text-decoration: underline;" target="_blank">Google Report</a>
       </p>`
    : "";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #111827; background-color: #ffffff;">
  <div style="max-width: 600px; margin: 0; text-align: left;">
    <p style="margin: 0 0 16px 0;">Hi Team,</p>
    <p style="margin: 0 0 18px 0;">Please see the performance reports for the last month below.</p>

    ${reportLinkHtml}

    ${paragraphsHtml}

    <p style="margin: 24px 0 18px 0;">Let me know if you have any questions.</p>

    <p style="margin: 24px 0 14px 0; font-size: 14px; color: inherit;">KR</p>

    <!-- Uprise Executive Signature Footer -->
    <table border="0" cellspacing="0" cellpadding="0" style="margin-top: 10px; border-collapse: collapse;">
      <tr>
        <td valign="middle" style="padding-right: 18px; vertical-align: middle;">
          <img src="https://tools.uprisedigital.com.au/logo_black.png" alt="Uprise Digital" width="95" style="display: block; width: 95px; height: auto;" />
        </td>
        <td valign="middle" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13.5px; line-height: 1.45; vertical-align: middle;">
          <div style="font-weight: 700; font-size: 14.5px; color: #0a2540;">${senderName}</div>
          <div style="color: #475569; margin-top: 2px;">Founder | <strong style="color: #0a2540;">Uprise Digital</strong></div>
          <div style="color: #475569; margin-top: 2px;">${senderPhone}</div>
          <div style="margin-top: 2px;">
            <a href="https://${cleanWebsite}" style="color: #1155cc; text-decoration: underline;">${cleanWebsite}</a>
          </div>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`;
}

export function buildExecutiveReportEmailHtml(data: {
  recipientGreeting?: string;
  reportContentHtml: string;
  senderName?: string;
  senderTitle?: string;
  senderPhone?: string;
  senderWebsite?: string;
  clientName?: string;
}): string {
  const greeting = data.recipientGreeting || "Hi Team,";
  const senderName = data.senderName || "Lakshane Fonseka";
  const senderRole = data.senderTitle || "Founder | Uprise Digital";
  const senderPhone = data.senderPhone || "+61 426 759 756";
  const senderWebsite = data.senderWebsite || "www.uprisedigital.com.au";
  const cleanWebsite = senderWebsite.replace(/^https?:\/\//, "");
  const clientName = data.clientName || "Client";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #111827; background-color: #ffffff;">
  <div style="max-width: 600px; margin: 0; text-align: left;">
    <p style="margin: 0 0 16px 0;">${greeting}</p>
    <p style="margin: 0 0 18px 0;">Please see the performance reports for the last month below.</p>

    ${data.reportContentHtml}

    <p style="margin: 24px 0 18px 0;">Let me know if you have any questions.</p>

    <p style="margin: 24px 0 14px 0; font-size: 14px; color: inherit;">KR</p>

    <!-- Uprise Executive Signature Footer -->
    <table border="0" cellspacing="0" cellpadding="0" style="margin-top: 10px; border-collapse: collapse;">
      <tr>
        <td valign="middle" style="padding-right: 18px; vertical-align: middle;">
          <img src="https://tools.uprisedigital.com.au/logo_black.png" alt="Uprise Digital" width="95" style="display: block; width: 95px; height: auto;" />
        </td>
        <td valign="middle" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13.5px; line-height: 1.45; vertical-align: middle;">
          <div style="font-weight: 700; font-size: 14.5px; color: #0a2540;">${senderName}</div>
          <div style="color: #475569; margin-top: 2px;">Founder | <strong style="color: #0a2540;">Uprise Digital</strong></div>
          <div style="color: #475569; margin-top: 2px;">${senderPhone}</div>
          <div style="margin-top: 2px;">
            <a href="https://${cleanWebsite}" style="color: #1155cc; text-decoration: underline;">${cleanWebsite}</a>
          </div>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`;
}


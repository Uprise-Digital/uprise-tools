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
}): string {
  const { clientName, introText, metrics, targetMonth } = data;

  const conversions = metrics?.conversions ?? "0";
  const cost = metrics?.cost ? `$${metrics.cost}` : "-";
  const clicks = metrics?.clicks ?? "-";
  const ctr = metrics?.ctr ? `${metrics.ctr}%` : "-";
  const monthDisplay = targetMonth || "Monthly";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${monthDisplay} Performance Report - ${clientName}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #334155;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 12px 32px rgba(15, 23, 42, 0.06);">
          
          <!-- BRAND HEADER WITH OFFICIAL LOGO -->
          <tr>
            <td style="background-color: #070514; padding: 28px 36px; text-align: left;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <!-- OFFICIAL UPRISE LOGO IMAGE -->
                    <img src="https://uprisedigital.com.au/wp-content/uploads/2025/02/rev4-03-1.webp" alt="Uprise Digital" height="34" style="display: block; border: 0; max-height: 34px; width: auto;" />
                  </td>
                  <td align="right" valign="middle">
                    <div style="display: inline-block; font-size: 10px; font-weight: 600; color: #cbd5e1; background-color: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.15); padding: 5px 12px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.6px;">
                      Monthly Performance Report
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- REPORT TITLE BAR -->
          <tr>
            <td style="padding: 28px 36px 16px 36px;">
              <div style="font-size: 11px; font-weight: 700; color: #7c3aed; text-transform: uppercase; letter-spacing: 1.2px; margin-bottom: 4px;">
                Monthly Performance Report &bull; ${monthDisplay}
              </div>
              <div style="font-size: 22px; font-weight: 800; color: #0f172a; letter-spacing: -0.3px;">
                ${clientName}
              </div>
            </td>
          </tr>

          <!-- MAIN CONTENT -->
          <tr>
            <td style="padding: 0px 36px 28px 36px;">
              <!-- INTRO PARAGRAPH -->
              <div style="font-size: 14.5px; line-height: 1.65; color: #334155; margin-bottom: 28px; background-color: #faf5ff; border: 1px solid #f3e8ff; border-radius: 12px; padding: 18px 20px;">
                ${introText}
              </div>

              <!-- KEY METRICS PREVIEW -->
              <div style="margin-bottom: 28px;">
                <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 1px; margin-bottom: 12px;">
                  Key Campaign Metrics Summary
                </div>
                <table width="100%" border="0" cellspacing="0" cellpadding="0">
                  <tr>
                    <td width="48%" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-top: 3px solid #7c3aed; border-radius: 12px; padding: 16px 18px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                      <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.8px;">Conversions</div>
                      <div style="font-size: 24px; font-weight: 800; color: #0f172a; margin-top: 4px;">${conversions}</div>
                    </td>
                    <td width="4%"></td>
                    <td width="48%" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-top: 3px solid #7c3aed; border-radius: 12px; padding: 16px 18px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                      <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.8px;">Total Spend</div>
                      <div style="font-size: 24px; font-weight: 800; color: #0f172a; margin-top: 4px;">${cost}</div>
                    </td>
                  </tr>
                  <tr><td height="12" colSpan="3"></td></tr>
                  <tr>
                    <td width="48%" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-top: 3px solid #7c3aed; border-radius: 12px; padding: 16px 18px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                      <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.8px;">Total Clicks</div>
                      <div style="font-size: 24px; font-weight: 800; color: #0f172a; margin-top: 4px;">${clicks}</div>
                    </td>
                    <td width="4%"></td>
                    <td width="48%" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-top: 3px solid #7c3aed; border-radius: 12px; padding: 16px 18px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                      <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.8px;">Click-Through Rate</div>
                      <div style="font-size: 24px; font-weight: 800; color: #6d28d9; margin-top: 4px;">${ctr}</div>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- ATTACHMENT NOTICE BOX -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #fcfaff; border: 1px solid #e9d5ff; border-left: 4px solid #7c3aed; border-radius: 10px; padding: 16px 18px; margin-bottom: 24px;">
                <tr>
                  <td>
                    <div style="font-size: 13.5px; font-weight: 700; color: #4c1d95;">
                      📄 Complete PDF Performance Report Attached
                    </div>
                    <div style="font-size: 12.5px; color: #475569; margin-top: 4px; line-height: 1.55;">
                      Your full monthly performance breakdown, search term analytics, top ad creative showcase, and strategic growth roadmap are attached as a PDF document.
                    </div>
                  </td>
                </tr>
              </table>

              <!-- SIGNAL CONTACT NOTICE -->
              <div style="font-size: 13.5px; color: #475569; line-height: 1.6; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px;">
                💬 Have questions about your report or next month's strategy? Please contact your account manager directly through <strong>Signal</strong>.
              </div>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background-color: #f8fafc; padding: 24px 36px; border-top: 1px solid #e2e8f0; text-align: left;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <div style="font-size: 13.5px; font-weight: 800; color: #0f172a;">
                      The Uprise Digital Team
                    </div>
                    <div style="font-size: 11.5px; color: #64748b; margin-top: 2px;">
                      Strategy &bull; Marketing &bull; Sales Optimisation
                    </div>
                  </td>
                  <td align="right">
                    <a href="https://uprisedigital.com.au" style="display: inline-block; background-color: #7c3aed; color: #ffffff; font-size: 11px; font-weight: 700; text-decoration: none; padding: 8px 18px; border-radius: 9999px; letter-spacing: 0.3px;">
                      Visit Website &rarr;
                    </a>
                  </td>
                </tr>
              </table>
              <div style="font-size: 11px; color: #94a3b8; margin-top: 16px; line-height: 1.5; border-top: 1px solid #e2e8f0; padding-top: 12px;">
                This email and any files transmitted with it are confidential and intended solely for the use of ${clientName}.
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}


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
}): string {
  const { clientName, introText, metrics } = data;

  const conversions = metrics?.conversions ?? "0";
  const cost = metrics?.cost ? `$${metrics.cost}` : "-";
  const clicks = metrics?.clicks ?? "-";
  const ctr = metrics?.ctr ? `${metrics.ctr}%` : "-";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Monthly Performance Report - ${clientName}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #334155;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          
          <!-- BRAND HEADER -->
          <tr>
            <td style="background-color: #0f172a; padding: 32px 36px; text-align: left;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <div style="font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px; text-transform: uppercase;">
                      UPRISE <span style="color: #38bdf8;">DIGITAL</span>
                    </div>
                    <div style="font-size: 12px; color: #94a3b8; margin-top: 4px; font-weight: 500; letter-spacing: 0.5px;">
                      Monthly Performance Report &bull; ${clientName}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- MAIN CONTENT -->
          <tr>
            <td style="padding: 36px 36px 24px 36px;">
              <!-- INTRO PARAGRAPH -->
              <div style="font-size: 15px; line-height: 1.7; color: #334155; margin-bottom: 28px;">
                ${introText}
              </div>

              <!-- KEY METRICS PREVIEW -->
              <div style="margin-bottom: 28px;">
                <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 1px; margin-bottom: 12px;">
                  Monthly Metrics Overview
                </div>
                <table width="100%" border="0" cellspacing="0" cellpadding="0">
                  <tr>
                    <td width="48%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px;">
                      <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.8px;">Conversions</div>
                      <div style="font-size: 22px; font-weight: 800; color: #0f172a; margin-top: 4px;">${conversions}</div>
                    </td>
                    <td width="4%"></td>
                    <td width="48%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px;">
                      <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.8px;">Total Spend</div>
                      <div style="font-size: 22px; font-weight: 800; color: #0f172a; margin-top: 4px;">${cost}</div>
                    </td>
                  </tr>
                  <tr><td height="12" colSpan="3"></td></tr>
                  <tr>
                    <td width="48%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px;">
                      <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.8px;">Clicks</div>
                      <div style="font-size: 22px; font-weight: 800; color: #0f172a; margin-top: 4px;">${clicks}</div>
                    </td>
                    <td width="4%"></td>
                    <td width="48%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px;">
                      <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.8px;">CTR</div>
                      <div style="font-size: 22px; font-weight: 800; color: #0f172a; margin-top: 4px;">${ctr}</div>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- ATTACHMENT NOTICE BOX -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f0f9ff; border: 1px solid #bae6fd; border-radius: 12px; padding: 16px; margin-bottom: 28px;">
                <tr>
                  <td>
                    <div style="font-size: 13px; font-weight: 600; color: #0369a1;">
                      📄 Complete PDF Report Attached
                    </div>
                    <div style="font-size: 12px; color: #0284c7; margin-top: 4px; line-height: 1.5;">
                      Your full monthly performance breakdown, search term analytics, and campaign insights are attached as a PDF document.
                    </div>
                  </td>
                </tr>
              </table>

              <div style="font-size: 14px; color: #475569; line-height: 1.6;">
                Please let us know if you have any questions or would like to discuss next steps.
              </div>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background-color: #f8fafc; padding: 24px 36px; border-top: 1px solid #e2e8f0; text-align: left;">
              <div style="font-size: 13px; font-weight: 700; color: #1e293b;">
                The Uprise Digital Team
              </div>
              <div style="font-size: 12px; color: #64748b; margin-top: 2px;">
                Uprise Digital &bull; Performance Marketing
              </div>
              <div style="font-size: 11px; color: #94a3b8; margin-top: 16px; line-height: 1.5;">
                This email and any files transmitted with it are confidential and intended solely for the use of the individual or entity to whom they are addressed.
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

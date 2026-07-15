/**
 * Helper to compile onboarding email bodies.
 */
export function compileOnboardingEmail(params: {
  primaryContactName: string;
  clientName: string;
  driveFolderLink: string;
  notionDashboardLink: string;
  signalGroupLink: string;
  googleAdsAccess: boolean;
  metaAdsAccess: boolean;
  orgName?: string;
}) {
  const {
    primaryContactName,
    clientName,
    driveFolderLink,
    notionDashboardLink,
    signalGroupLink,
    googleAdsAccess,
    metaAdsAccess,
    orgName = "Uprise Digital",
  } = params;

  let adsInstructionsText = "";
  let adsInstructionsHtml = "";

  if (googleAdsAccess) {
    adsInstructionsText += `To grant us access to your Google Ads account, please follow the steps here: https://tools.uprisedigital.com.au/docs/client-guides/google-ads-access\n\n`;
    adsInstructionsHtml += `<p style="margin-bottom: 12px;">To grant us access to your Google Ads account, please follow the steps here: <a href="https://tools.uprisedigital.com.au/docs/client-guides/google-ads-access" style="color: #4f46e5; text-decoration: underline; font-weight: 600;">Google Ads Account Access Instructions</a></p>`;
  }

  if (metaAdsAccess) {
    adsInstructionsText += `To grant us access to your Meta Ads account, please follow the steps here: https://tools.uprisedigital.com.au/docs/client-guides/meta-ads-access\n\n`;
    adsInstructionsHtml += `<p style="margin-bottom: 12px;">To grant us access to your Meta Ads account, please follow the steps here: <a href="https://tools.uprisedigital.com.au/docs/client-guides/meta-ads-access" style="color: #4f46e5; text-decoration: underline; font-weight: 600;">Meta Ads Account Access Instructions</a></p>`;
  }

  const textBody = `Hi ${primaryContactName},

Great to have you on board!
Firstly, thank you for booking your onboarding call - we're looking forward to it.

To help us hit the ground running, we'd really appreciate it if you could complete the steps below before your onboarding call:

To help us with creating your ad assets, I've created your Google Drive Folder: Media Assets (Images and Videos) (${driveFolderLink}).
Please upload all your media assets like photos, videos, and logos (preferably in high-quality PNG format) inside the Media Assets (Images and Videos) folder.

You can access the ${orgName} x ${clientName} (${notionDashboardLink}) dashboard here. We'll use this dashboard to record all details discussed during the onboarding call for your reference.

Here's a link to your Signal Group. Here, we can communicate instantly to provide you updates or requests immediately. Please click on the hyperlinks below for your reference:

    Download Signal on your mobile device
        Apple: https://apps.apple.com/us/app/signal-private-messenger/id874139669
        Android: https://play.google.com/store/apps/details?id=org.thoughtcrime.secureshare
    Click on the hyperlink below to join the ${orgName} group chat
    ${orgName} x ${clientName} (${signalGroupLink})

${adsInstructionsText}
Feel free to reach out if you have any questions or concerns. Don't hesitate to reach out; we're here to help.

Thank you and have a great day!

Lakshane Fonseka
Founder | ${orgName}
+61 426 759 756
www.uprisedigital.com.au`;

  const htmlBody = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px;">
  <p style="font-size: 16px; margin-bottom: 16px;">Hi ${primaryContactName},</p>
  
  <p style="font-size: 16px; margin-bottom: 16px;">Great to have you on board!</p>
  <p style="font-size: 16px; margin-bottom: 24px;">Firstly, thank you for booking your onboarding call - we're looking forward to it.</p>
  
  <p style="font-size: 15px; font-weight: 600; color: #0f172a; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 0.5px;">To help us hit the ground running, we'd really appreciate it if you could complete the steps below before your onboarding call:</p>
  
  <div style="background-color: #f8fafc; border-left: 4px solid #4f46e5; padding: 16px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
    <p style="margin: 0 0 8px 0; font-weight: 600; color: #0f172a;">1. Upload Media Assets</p>
    <p style="margin: 0; font-size: 14px; color: #475569;">To help us with creating your ad assets, I've created your Google Drive Folder: 
      <a href="${driveFolderLink}" style="color: #4f46e5; text-decoration: underline; font-weight: 600;">Media Assets (Images and Videos)</a>.<br/>
      Please upload all your media assets like photos, videos, and logos (preferably in high-quality PNG format) inside the folder.
    </p>
  </div>
 
  <div style="background-color: #f8fafc; border-left: 4px solid #4f46e5; padding: 16px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
    <p style="margin: 0 0 8px 0; font-weight: 600; color: #0f172a;">2. Client Dashboard</p>
    <p style="margin: 0; font-size: 14px; color: #475569;">You can access the 
      <a href="${notionDashboardLink}" style="color: #4f46e5; text-decoration: underline; font-weight: 600;">${orgName} x ${clientName}</a> 
      dashboard here. We'll use this dashboard to record all details discussed during the onboarding call for your reference.
    </p>
  </div>

  <div style="background-color: #f8fafc; border-left: 4px solid #4f46e5; padding: 16px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
    <p style="margin: 0 0 8px 0; font-weight: 600; color: #0f172a;">3. Join Signal Group</p>
    <p style="margin: 0 0 12px 0; font-size: 14px; color: #475569;">Here's a link to your Signal Group so we can communicate instantly. Please click the links below:</p>
    <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #475569;">
      <li style="margin-bottom: 4px;">Download Signal: 
        <a href="https://apps.apple.com/us/app/signal-private-messenger/id874139669" style="color: #4f46e5; text-decoration: none;">Apple</a> | 
        <a href="https://play.google.com/store/apps/details?id=org.thoughtcrime.secureshare" style="color: #4f46e5; text-decoration: none;">Android</a>
      </li>
      <li>Join group chat: 
        <a href="${signalGroupLink}" style="color: #4f46e5; text-decoration: underline; font-weight: 600;">${orgName} x ${clientName}</a>
      </li>
    </ul>
  </div>

  ${
    adsInstructionsHtml
      ? `
  <div style="background-color: #f8fafc; border-left: 4px solid #4f46e5; padding: 16px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
    <p style="margin: 0 0 8px 0; font-weight: 600; color: #0f172a;">4. Grant Account Access</p>
    <div style="font-size: 14px; color: #475569;">
      ${adsInstructionsHtml}
    </div>
  </div>
  `
      : ""
  }

  <p style="font-size: 15px; margin-top: 24px; margin-bottom: 24px; color: #475569;">Feel free to reach out if you have any questions or concerns. We are here to help!</p>
  
  <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />

  <p style="font-size: 14px; font-weight: bold; margin: 0 0 4px 0; color: #0f172a;">Lakshane Fonseka</p>
  <p style="font-size: 12px; color: #64748b; margin: 0 0 4px 0;">Founder | ${orgName}</p>
  <p style="font-size: 12px; color: #64748b; margin: 0 0 4px 0;">+61 426 759 756</p>
  <p style="font-size: 12px; color: #64748b; margin: 0;"><a href="https://www.uprisedigital.com.au" style="color: #4f46e5; text-decoration: none;">www.uprisedigital.com.au</a></p>
</div>`;

  return { text: textBody, html: htmlBody };
}

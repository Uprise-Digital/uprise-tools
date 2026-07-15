import { eq } from "drizzle-orm";
import { google } from "googleapis";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { organizationOnboardingSettings } from "@/db/schema";
import { encryptToken } from "@/lib/crypto";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const orgId = searchParams.get("state");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (error) {
    console.error("Google Drive OAuth Callback Error:", error);
    return NextResponse.redirect(`${appUrl}/settings?error=${error}`);
  }

  if (!code || !orgId) {
    return new NextResponse("Missing code or state", { status: 400 });
  }

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = `${appUrl}/api/auth/google-drive/callback`;

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri,
    );

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    if (!tokens.refresh_token) {
      console.warn(
        "Google Drive OAuth Callback: No refresh token returned. User might need to re-consent.",
      );
    }

    // Retrieve the authorized user's email address
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    const userEmail = userInfo.data.email;

    if (!userEmail) {
      throw new Error("Failed to retrieve user email from Google Profile.");
    }

    // Encrypt the refresh token for security
    const encryptedRefreshToken = tokens.refresh_token
      ? encryptToken(tokens.refresh_token)
      : null;

    // Check if onboarding settings already exist for this organization
    const existing = await db.query.organizationOnboardingSettings.findFirst({
      where: eq(organizationOnboardingSettings.organizationId, orgId),
    });

    if (existing) {
      await db
        .update(organizationOnboardingSettings)
        .set({
          googleDriveEmail: userEmail,
          // Only overwrite refresh token if Google returned a new one (typical for consent prompt)
          ...(encryptedRefreshToken && {
            googleDriveRefreshToken: encryptedRefreshToken,
          }),
          googleDriveStatus: "unconfigured",
          googleDriveError: null,
          updatedAt: new Date(),
        })
        .where(eq(organizationOnboardingSettings.organizationId, orgId));
    } else {
      await db.insert(organizationOnboardingSettings).values({
        organizationId: orgId,
        googleDriveEnabled: false,
        googleDriveEmail: userEmail,
        googleDriveRefreshToken: encryptedRefreshToken,
        googleDriveStatus: "unconfigured",
        notionEnabled: false,
        notionStatus: "unconfigured",
      });
    }

    return NextResponse.redirect(`${appUrl}/settings?tab=onboarding`);
  } catch (err: any) {
    console.error("Google Drive OAuth Callback Exception:", err);
    return NextResponse.redirect(
      `${appUrl}/settings?error=${encodeURIComponent(err.message || "Failed Google Drive connection")}`,
    );
  }
}

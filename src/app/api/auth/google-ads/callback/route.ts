import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { googleAdsConnections } from "@/db/schema";
import { auth } from "@/lib/auth";
import { encryptToken } from "@/lib/crypto";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const orgId = searchParams.get("state"); // orgId passed in state parameter
  const error = searchParams.get("error");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (error) {
    console.error("Google OAuth error:", error);
    return NextResponse.redirect(
      `${appUrl}/onboarding/connect-ads?orgId=${orgId}&error=${error}`,
    );
  }

  if (!code || !orgId) {
    return new NextResponse("Missing authorization code or state", {
      status: 400,
    });
  }

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = `${appUrl}/api/auth/google-ads/callback`;

    // 1. Exchange auth code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId!,
        client_secret: clientSecret!,
        code: code,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenRes.json();
    if (tokenData.error) {
      throw new Error(
        `Token exchange failed: ${tokenData.error_description || tokenData.error}`,
      );
    }

    const { access_token, refresh_token } = tokenData;

    if (!refresh_token) {
      console.warn(
        "No refresh token received. Ensure you revoke app access first and retry.",
      );
      // We will still try to proceed, but standard flow requires consent prompt to always get refresh token
    }

    // 2. Fetch userinfo to retrieve the connected Google account's email
    const userinfoRes = await fetch(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      },
    );
    const userinfo = await userinfoRes.json();
    const connectedEmail = userinfo.email || "unknown@google.com";

    // 3. Encrypt the refresh token
    const encryptedRefreshToken = encryptToken(refresh_token || "");

    // 4. Save connection to DB
    const [conn] = await db
      .insert(googleAdsConnections)
      .values({
        organizationId: orgId,
        refreshToken: encryptedRefreshToken,
        connectedEmail: connectedEmail,
        managerCustomerId: "", // Initialized as empty, set during MCC selection step
        status: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning({ id: googleAdsConnections.id });

    // 5. Redirect user to MCC selection screen
    return NextResponse.redirect(
      `${appUrl}/onboarding/mcc-select?connectionId=${conn.id}&orgId=${orgId}`,
    );
  } catch (err: any) {
    console.error("Failed to handle Google Ads callback:", err);
    return NextResponse.redirect(
      `${appUrl}/onboarding/connect-ads?orgId=${orgId}&error=${encodeURIComponent(err.message)}`,
    );
  }
}

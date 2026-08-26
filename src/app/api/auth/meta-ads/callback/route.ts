import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { metaAdsConnections } from "@/db/schema";
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
  const orgId = searchParams.get("state");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:8080";

  if (error) {
    console.error("Meta OAuth error:", error, errorDescription);
    return NextResponse.redirect(
      `${appUrl}/settings?meta_error=${encodeURIComponent(errorDescription || error)}`,
    );
  }

  if (!code || !orgId) {
    return new NextResponse("Missing authorization code or state", {
      status: 400,
    });
  }

  try {
    const clientId = process.env.META_CLIENT_ID;
    const clientSecret = process.env.META_CLIENT_SECRET;
    const redirectUri = `${appUrl}/api/auth/meta-ads/callback`;

    if (!clientId || !clientSecret) {
      throw new Error(
        "Meta OAuth client ID or client secret missing in environment.",
      );
    }

    // 1. Exchange auth code for short-lived user token
    const tokenUrl = new URL(
      "https://graph.facebook.com/v19.0/oauth/access_token",
    );
    tokenUrl.searchParams.set("client_id", clientId);
    tokenUrl.searchParams.set("client_secret", clientSecret);
    tokenUrl.searchParams.set("redirect_uri", redirectUri);
    tokenUrl.searchParams.set("code", code);

    const tokenRes = await fetch(tokenUrl.toString());
    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      throw new Error(
        `Meta Token Exchange Error: ${tokenData.error.message || JSON.stringify(tokenData.error)}`,
      );
    }

    const shortLivedToken = tokenData.access_token;

    // 2. Exchange short-lived token for 60-day Long-Lived Token
    const longLivedUrl = new URL(
      "https://graph.facebook.com/v19.0/oauth/access_token",
    );
    longLivedUrl.searchParams.set("grant_type", "fb_exchange_token");
    longLivedUrl.searchParams.set("client_id", clientId);
    longLivedUrl.searchParams.set("client_secret", clientSecret);
    longLivedUrl.searchParams.set("fb_exchange_token", shortLivedToken);

    const longLivedRes = await fetch(longLivedUrl.toString());
    const longLivedData = await longLivedRes.json();

    const finalAccessToken = longLivedData.access_token || shortLivedToken;
    const expiresInSeconds = longLivedData.expires_in; // e.g. 5184000 (60 days)
    const tokenExpiresAt = expiresInSeconds
      ? new Date(Date.now() + expiresInSeconds * 1000)
      : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

    // 3. Fetch user profile from Meta Graph API
    const userRes = await fetch(
      `https://graph.facebook.com/v19.0/me?fields=id,name,email&access_token=${finalAccessToken}`,
    );
    const userData = await userRes.json();

    const connectedEmail =
      userData.email || userData.name || `meta_user_${userData.id}`;
    const metaUserId = userData.id;

    // 4. Encrypt the access token before saving to database
    const encryptedToken = encryptToken(finalAccessToken);

    // 5. Upsert connection in DB for this organization
    const existingConn = await db.query.metaAdsConnections.findFirst({
      where: eq(metaAdsConnections.organizationId, orgId),
    });

    if (existingConn) {
      await db
        .update(metaAdsConnections)
        .set({
          connectedEmail: connectedEmail,
          metaUserId: metaUserId,
          accessToken: encryptedToken,
          tokenExpiresAt: tokenExpiresAt,
          status: "active",
          accessLevel: "read_only",
          errorMessage: null,
          updatedAt: new Date(),
        })
        .where(eq(metaAdsConnections.id, existingConn.id));
    } else {
      await db.insert(metaAdsConnections).values({
        organizationId: orgId,
        connectedEmail: connectedEmail,
        metaUserId: metaUserId,
        accessToken: encryptedToken,
        tokenExpiresAt: tokenExpiresAt,
        status: "active",
        accessLevel: "read_only",
        autoAddAccounts: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // 6. Redirect user back to settings with success flag
    return NextResponse.redirect(`${appUrl}/settings?meta_connected=true`);
  } catch (err: any) {
    console.error("Failed to complete Meta OAuth callback:", err);
    return NextResponse.redirect(
      `${appUrl}/settings?meta_error=${encodeURIComponent(err.message || "Failed to connect Meta account")}`,
    );
  }
}

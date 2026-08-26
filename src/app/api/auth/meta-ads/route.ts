import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const orgId =
    searchParams.get("orgId") || session.session.activeOrganizationId;

  if (!orgId) {
    return new NextResponse("Missing organization ID", { status: 400 });
  }

  const clientId = process.env.META_CLIENT_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:8080";
  const redirectUri = `${appUrl}/api/auth/meta-ads/callback`;

  if (!clientId) {
    return new NextResponse("META_CLIENT_ID not configured", { status: 500 });
  }

  // Read-only scopes for Meta Ads & Lead Ads
  const scopes = [
    "ads_read",
    "read_insights",
    "pages_show_list",
    "leads_retrieval",
  ].join(",");

  const metaAuthUrl = new URL("https://www.facebook.com/v19.0/dialog/oauth");
  metaAuthUrl.searchParams.set("client_id", clientId);
  metaAuthUrl.searchParams.set("redirect_uri", redirectUri);
  metaAuthUrl.searchParams.set("state", orgId);
  metaAuthUrl.searchParams.set("scope", scopes);
  metaAuthUrl.searchParams.set("response_type", "code");

  return NextResponse.redirect(metaAuthUrl.toString());
}

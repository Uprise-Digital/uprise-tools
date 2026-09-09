import { type NextRequest, NextResponse } from "next/server";
import { getAuthOrgContext } from "@/lib/auth-helpers";
import { searchGhlContacts } from "@/service/gohighlevel-service";

export async function GET(req: NextRequest) {
  try {
    const authContext = await getAuthOrgContext();
    if (!authContext || !authContext.orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const query = (
      searchParams.get("q") ||
      searchParams.get("query") ||
      ""
    ).trim();

    if (query.length < 2) {
      return NextResponse.json({ contacts: [] });
    }

    const contacts = await searchGhlContacts(query, authContext.orgId);
    return NextResponse.json({ success: true, contacts });
  } catch (error: any) {
    console.error("GHL Search Proxy Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || String(error) },
      { status: 500 },
    );
  }
}

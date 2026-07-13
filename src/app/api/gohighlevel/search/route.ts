import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { searchGhlContacts } from "@/service/gohighlevel-service";

export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("query") || "";

    if (query.trim().length < 2) {
      return NextResponse.json({ contacts: [] });
    }

    const contacts = await searchGhlContacts(query);
    return NextResponse.json({ success: true, contacts });
  } catch (error: any) {
    console.error("GHL Search Proxy Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || String(error) },
      { status: 500 },
    );
  }
}

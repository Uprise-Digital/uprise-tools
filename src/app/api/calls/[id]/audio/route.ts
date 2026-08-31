import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { callRecords } from "@/db/schema";
import { getGhlCredentials } from "@/service/gohighlevel-service";
import { fetchGhlCallAudioBuffer } from "@/service/call-intelligence-service";

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  try {
    const params = await props.params;
    const callId = parseInt(params.id, 10);
    if (isNaN(callId)) {
      return new NextResponse("Invalid call ID", { status: 400 });
    }

    const [record] = await db
      .select()
      .from(callRecords)
      .where(eq(callRecords.id, callId))
      .limit(1);

    if (!record) {
      return new NextResponse("Call record not found", { status: 404 });
    }

    const { apiKey } = await getGhlCredentials(record.organizationId);
    const { buffer, contentType } = await fetchGhlCallAudioBuffer(
      record.ghlMessageId,
      record.ghlLocationId,
      apiKey,
    );

    const rangeHeader = req.headers.get("range");

    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : buffer.length - 1;
      const chunk = buffer.subarray(start, end + 1);

      return new NextResponse(chunk as any, {
        status: 206,
        headers: {
          "Content-Range": `bytes ${start}-${end}/${buffer.length}`,
          "Accept-Ranges": "bytes",
          "Content-Length": String(chunk.length),
          "Content-Type": contentType,
        },
      });
    }

    return new NextResponse(buffer as any, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(buffer.length),
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (error: any) {
    console.error("Error streaming call audio:", error);
    return new NextResponse(
      `Audio streaming failed: ${error.message || "Unknown error"}`,
      { status: 500 },
    );
  }
}

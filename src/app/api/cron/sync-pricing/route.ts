import * as cheerio from "cheerio";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { aiModelPricing } from "@/db/schema";

export const maxDuration = 120; // 2 minutes

// Official Fallback/Seed pricing if scraping fails or site changes
const FALLBACK_PRICING = [
  {
    modelName: "gemini-3.5-flash",
    inputCostPerMillion: "1.500000",
    outputCostPerMillion: "9.000000",
  },
  {
    modelName: "gemini-3.5-live-translate-preview",
    inputCostPerMillion: "3.500000",
    outputCostPerMillion: "21.000000",
  },
  {
    modelName: "gemini-3.1-flash-lite",
    inputCostPerMillion: "0.250000",
    outputCostPerMillion: "1.500000",
  },
  {
    modelName: "gemini-3.1-pro-preview",
    inputCostPerMillion: "2.000000",
    outputCostPerMillion: "12.000000",
  },
  {
    modelName: "gemini-2.5-flash",
    inputCostPerMillion: "0.300000",
    outputCostPerMillion: "2.500000",
  },
  {
    modelName: "gemini-2.5-pro",
    inputCostPerMillion: "1.250000",
    outputCostPerMillion: "10.000000",
  },
  {
    modelName: "gemini-2.5-flash-lite",
    inputCostPerMillion: "0.100000",
    outputCostPerMillion: "0.400000",
  },
  {
    modelName: "gemini-1.5-flash",
    inputCostPerMillion: "0.300000",
    outputCostPerMillion: "2.500000",
  }, // same as 2.5 flash
];

export async function POST(request: Request) {
  return await handlePricingSync(request);
}

export async function GET(request: Request) {
  return await handlePricingSync(request);
}

async function handlePricingSync(request: Request) {
  try {
    // 1. Verify Secret Token
    const authHeader = request.headers.get("authorization");
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get("secret");
    const expectedToken = `Bearer ${process.env.CRON_SECRET}`;

    const isAuthorized =
      (process.env.CRON_SECRET && authHeader === expectedToken) ||
      (process.env.CRON_SECRET && secret === process.env.CRON_SECRET) ||
      process.env.NODE_ENV === "development"; // Allow local dev testing easily

    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("[Pricing Sync] Fetching current Gemini pricing...");

    const syncedPricing = [...FALLBACK_PRICING];
    let scrapeSuccess = false;

    // 2. Try scraping official Google Gemini developer pricing docs
    try {
      const response = await fetch(
        "https://ai.google.dev/gemini-api/docs/pricing",
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
          },
          next: { revalidate: 3600 }, // Cache for 1 hour in Next
        },
      );

      if (response.ok) {
        const html = await response.text();
        const $ = cheerio.load(html);

        // We find tables and associate them with models
        // A typical model layout has:
        // An element containing the model name, e.g. gemini-3.5-flash
        // Followed by a table containing "Input price" and "Output price" rows.
        $("table").each((i, tableEl) => {
          const tableText = $(tableEl).text().toLowerCase();
          if (
            tableText.includes("input price") ||
            tableText.includes("output price")
          ) {
            // Find adjacent header/code tag representing the model name
            let modelName = "";

            // Search backwards for a header/code element containing "gemini-"
            let prev = $(tableEl).prev();
            let attempts = 0;
            while (prev.length > 0 && attempts < 15) {
              const text = prev.text().toLowerCase().trim();
              const match = text.match(/gemini-[a-z0-9.-]+/);
              if (match) {
                modelName = match[0];
                break;
              }
              prev = prev.prev();
              attempts++;
            }

            if (modelName) {
              // Parse rows for Input price and Output price
              let inputPrice = "";
              let outputPrice = "";

              $(tableEl)
                .find("tr")
                .each((j, trEl) => {
                  const cells = $(trEl).find("td");
                  if (cells.length >= 2) {
                    const label = $(cells[0]).text().toLowerCase();
                    const value = $(cells[cells.length - 1])
                      .text()
                      .trim(); // typically the last column is paid tier price

                    if (label.includes("input price")) {
                      inputPrice = value;
                    } else if (label.includes("output price")) {
                      outputPrice = value;
                    }
                  }
                });

              // Clean up parsed price (e.g. "$1.50" -> "1.50")
              const cleanPrice = (val: string) => {
                const match = val.match(/\$?([0-9.]+)/);
                return match ? match[1] : "";
              };

              const parsedInput = cleanPrice(inputPrice);
              const parsedOutput = cleanPrice(outputPrice);

              if (parsedInput && parsedOutput) {
                const existingIndex = syncedPricing.findIndex(
                  (m) => m.modelName === modelName,
                );
                const modelData = {
                  modelName,
                  inputCostPerMillion: parseFloat(parsedInput).toFixed(6),
                  outputCostPerMillion: parseFloat(parsedOutput).toFixed(6),
                };

                if (existingIndex > -1) {
                  syncedPricing[existingIndex] = modelData;
                } else {
                  syncedPricing.push(modelData);
                }
                scrapeSuccess = true;
              }
            }
          }
        });
      }
    } catch (scrapeError) {
      console.warn(
        "[Pricing Sync] Scraping failed, falling back to static rates:",
        scrapeError,
      );
    }

    console.log(
      `[Pricing Sync] Inserting ${syncedPricing.length} pricing records into DB. Scraped: ${scrapeSuccess}`,
    );

    // 3. Upsert into database
    for (const item of syncedPricing) {
      await db
        .insert(aiModelPricing)
        .values({
          modelName: item.modelName,
          inputCostPerMillion: item.inputCostPerMillion,
          outputCostPerMillion: item.outputCostPerMillion,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: aiModelPricing.modelName,
          set: {
            inputCostPerMillion: item.inputCostPerMillion,
            outputCostPerMillion: item.outputCostPerMillion,
            updatedAt: new Date(),
          },
        });
    }

    return NextResponse.json(
      {
        success: true,
        scraped: scrapeSuccess,
        count: syncedPricing.length,
        pricing: syncedPricing,
      },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("[Pricing Sync] Error syncing pricing:", error);
    return NextResponse.json(
      { error: error.message || "Failed to sync pricing" },
      { status: 500 },
    );
  }
}

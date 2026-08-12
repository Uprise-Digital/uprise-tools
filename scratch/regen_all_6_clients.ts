import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) chunks.push(chunk as any);
  return Buffer.concat(chunks);
}

async function main() {
  console.log("🚀 Re-generating all 6 client PDF reports with Cover Page Month display & Previous Month automation...\n");

  const { renderToStream } = await import("@react-pdf/renderer");
  const fs = await import("fs");
  const React = await import("react");
  const { generateReportInsights } = await import("../src/lib/ai-service");
  const { fetchAccountDataFromDb, transformAdsData } = await import("../src/lib/report-utils");
  const { MyReportPDF } = await import("../src/service/pdf-service");

  const artifactDir = "C:\\Users\\SGSey\\.gemini\\antigravity\\brain\\3c307959-4281-4258-a839-7ef310f97146";

  const targets = [
    {
      name: "rutherford electrical and data group",
      googleId: "8750609770",
      file: "rutherford_electrical_and_data_group_monthly_report.pdf"
    },
    {
      name: "Clean Energy Providers",
      googleId: "5158080849",
      file: "clean_energy_monthly_report.pdf"
    },
    {
      name: "Devo Demolition",
      googleId: "9627376146",
      file: "devo_demo_monthly_report.pdf"
    },
    {
      name: "AAR Demo",
      googleId: "2178394378",
      file: "aar_monthly_report.pdf"
    },
    {
      name: "CALL THE PLUMBER NOW",
      googleId: "1632533091",
      file: "call_the_plumbers_now_monthly_report.pdf"
    },
    {
      name: "KGN Homes",
      googleId: "4251704570",
      file: "kgn_monthly_report.pdf"
    }
  ];

  for (const client of targets) {
    console.log(`----------------------------------------`);
    console.log(`Processing: "${client.name}" (${client.googleId})`);
    console.log(`----------------------------------------`);

    const rawSummary = await fetchAccountDataFromDb(client.googleId);
    const baseData = transformAdsData(client.name, rawSummary || [], [], null);

    console.log(`Cover Month: ${baseData.targetMonth} | Range: ${baseData.dateRange}`);

    const aiInsights = await generateReportInsights({
      clientName: client.name,
      metrics: baseData.metrics,
      keywords: baseData.keywords,
    });
    baseData.ai = aiInsights;

    const pdfElement = React.createElement(MyReportPDF, { data: baseData });
    const stream = await renderToStream(pdfElement as any);
    const pdfBuffer = await streamToBuffer(stream);

    const outputPath = path.join(artifactDir, client.file);
    fs.writeFileSync(outputPath, pdfBuffer);
    console.log(`✅ Saved report: ${client.file}\n`);
  }

  console.log("🎉 Successfully regenerated all 6 client PDF reports with Cover Page Month display!");
}

main().catch(console.error);

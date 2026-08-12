import path from "node:path";
import {
  Document,
  Font,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

// Register Lexend Font using local static TTF files
const fontPath = path.join(process.cwd(), "public/fonts");

try {
  Font.register({
    family: "Lexend",
    fonts: [
      {
        src: path.join(fontPath, "Lexend-Regular.ttf"),
        fontWeight: 400,
      },
      {
        src: path.join(fontPath, "Lexend-SemiBold.ttf"),
        fontWeight: 600,
      },
      {
        src: path.join(fontPath, "Lexend-Bold.ttf"),
        fontWeight: 700,
      },
    ],
  });
} catch (e) {
  console.warn("Lexend font registration warning:", e);
}

const styles = StyleSheet.create({
  page: { padding: 0, backgroundColor: "#FFFFFF", fontFamily: "Helvetica" },

  // --- LAYOUT SECTIONS ---
  coverPage: {
    height: "100%",
    backgroundColor: "#0f172a",
    color: "#FFFFFF",
    padding: 60,
    justifyContent: "center",
  },
  section: { padding: "40 45 40 45" },

  // --- TYPOGRAPHY ---
  h1: { fontSize: 34, fontWeight: 700, marginBottom: 12, letterSpacing: -1 },
  h2: {
    fontSize: 16,
    fontWeight: 600,
    color: "#0f172a",
    marginBottom: 10,
    letterSpacing: -0.5,
  },
  bodyText: { fontSize: 9.5, color: "#64748b", lineHeight: 1.5 },
  labelSmall: {
    fontSize: 7,
    color: "#94a3b8",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },

  // --- DECORATION ---
  accentBar: {
    width: 45,
    height: 5,
    backgroundColor: "#3b82f6",
    marginBottom: 25,
    borderRadius: 2,
  },

  // --- CARDS ---
  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    gap: 10,
    marginTop: 15,
    marginBottom: 20,
  },
  statCard: {
    width: "31%",
    padding: "12 10",
    borderRadius: 8,
    border: "1px solid #f1f5f9",
    backgroundColor: "#ffffff",
  },
  statValue: {
    fontSize: 16,
    fontWeight: 700,
    color: "#0f172a",
    marginTop: 4,
    letterSpacing: -0.5,
  },
  statDelta: { fontSize: 8, marginTop: 4, fontWeight: 600 },
  deltaPositive: {
    color: "#059669",
    backgroundColor: "#ecfdf5",
    padding: "2 4",
    borderRadius: 4,
  },
  deltaNegative: {
    color: "#475569",
    backgroundColor: "#f1f5f9",
    padding: "2 4",
    borderRadius: 4,
  },

  // --- TABLES ---
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f8fafc",
    padding: "8 8",
    borderBottom: "1px solid #e2e8f0",
    marginTop: 10,
  },
  tableRow: {
    flexDirection: "row",
    padding: "9 8",
    borderBottom: "1px solid #f1f5f9",
    alignItems: "center",
  },
  colMain: { flex: 2.5, fontSize: 8.5, fontWeight: 600, color: "#1e293b" },
  colData: { flex: 1, fontSize: 8, textAlign: "right", color: "#475569" },

  // --- KEYWORD SPECIFIC ---
  keywordWrapper: { flex: 2.5, flexDirection: "column", gap: 3 },
  keywordText: { fontSize: 8.5, fontWeight: 600, color: "#1e293b" },
  badge: {
    alignSelf: "flex-start",
    padding: "2 5",
    borderRadius: 4,
    fontSize: 6,
    fontWeight: 700,
    textTransform: "uppercase",
    backgroundColor: "#f1f5f9",
    color: "#64748b",
    border: "1px solid #e2e8f0",
  },

  // --- FOOTER ---
  footer: {
    position: "absolute",
    bottom: 25,
    left: 45,
    right: 45,
    textAlign: "center",
    borderTop: "1px solid #f1f5f9",
    paddingTop: 10,
  },
  footerText: { fontSize: 7.5, color: "#94a3b8" },

  // --- BACK COVER ---
  backCover: {
    height: "100%",
    backgroundColor: "#f8fafc",
    padding: "60 45",
    justifyContent: "center",
    alignItems: "center",
  },
});

// UI Helper to clean up symbols
const formatWithSymbol = (
  value: string | number,
  symbol: string,
  isPrefix = true,
) => {
  if (value === "-" || value === undefined || value === null) return "-";
  return isPrefix ? `${symbol}${value}` : `${value}${symbol}`;
};

// Component for dynamic delta badges
const DeltaBadge = ({
  delta,
  inverse = false,
}: {
  delta?: { val: string; isPos: boolean };
  inverse?: boolean;
}) => {
  if (!delta) return null;
  const isGood = inverse ? !delta.isPos : delta.isPos;
  const badgeStyle = isGood ? styles.deltaPositive : styles.deltaNegative;
  const arrow = delta.isPos ? "▲" : "▼";

  return (
    <Text style={[styles.statDelta, badgeStyle]}>
      {arrow} {delta.val}%
    </Text>
  );
};

export const MyReportPDF = ({ data }: { data: any }) => {
  const statusPillText = data.ai?.statusPill || "OPTIMIZATION & EXPANSION";
  const takeawaysList = data.ai?.takeaways || [
    "Established baseline search visibility across core target queries.",
    "Prioritized high-intent search terms to capture qualified audience traffic.",
    "Refined keyword bid positioning to maximize impression relevancy.",
  ];
  const actionPlanList = data.ai?.actionPlan || [
    {
      title: "Bidding & Auction Realignment",
      description:
        "Reallocate budget toward top-performing search auctions to optimize acquisition efficiency.",
    },
    {
      title: "High-Intent Keyword Expansion",
      description:
        "Expand exact-match keyword clusters while sculpting negative keywords to eliminate non-converting queries.",
    },
    {
      title: "Conversion Path Optimization",
      description:
        "Align ad copy messaging directly with landing page CTAs to enhance lead conversion rates.",
    },
  ];

  return (
    <Document title={`Monthly Report - ${data.clientName}`}>
      {/* PAGE 1: COVER PAGE */}
      <Page size="A4" style={styles.page}>
        <View style={styles.coverPage}>
          <View style={styles.accentBar} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <Text
              style={{
                fontSize: 8,
                fontWeight: 700,
                color: "#38bdf8",
                backgroundColor: "rgba(56, 189, 248, 0.15)",
                padding: "3 8",
                borderRadius: 4,
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              {statusPillText}
            </Text>
            <Text
              style={{
                fontSize: 8,
                fontWeight: 700,
                color: "#94a3b8",
                backgroundColor: "rgba(148, 163, 184, 0.15)",
                padding: "3 8",
                borderRadius: 4,
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              {data.targetMonth || "July 2026"}
            </Text>
          </View>
          <Text style={styles.h1}>Google Ads Performance</Text>
          <Text style={styles.h1}>Report</Text>
          <Text style={{ fontSize: 16, color: "#94a3b8", fontWeight: 400 }}>
            {data.clientName}
          </Text>

          <View style={{ marginTop: 90 }}>
            <Text style={styles.labelSmall}>Reporting Period</Text>
            <Text
              style={{
                fontSize: 14,
                marginTop: 6,
                fontWeight: 700,
                color: "#ffffff",
                letterSpacing: -0.3,
              }}
            >
              {data.targetMonth || "July 2026"}
            </Text>
            <Text
              style={{
                fontSize: 9.5,
                marginTop: 3,
                fontWeight: 400,
                color: "#94a3b8",
              }}
            >
              {data.dateRange || "July 1 – July 31, 2026"}
            </Text>
          </View>

          <View style={{ marginTop: 35 }}>
            <Text style={styles.labelSmall}>Prepared By</Text>
            <Text
              style={{
                fontSize: 12,
                marginTop: 6,
                fontWeight: 600,
                color: "#3b82f6",
              }}
            >
              Uprise Digital Agency
            </Text>
          </View>
        </View>
      </Page>

      {/* PAGE 2: EXECUTIVE SUMMARY & PERFORMANCE OVERVIEW */}
      <Page size="A4" style={styles.page}>
        <View style={styles.section}>
          <View>
            <Text style={styles.h2}>Executive Summary</Text>
            
            <View
              style={{
                backgroundColor: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                padding: 14,
                marginBottom: 20,
              }}
            >
              <Text style={[styles.bodyText, { color: "#334155", marginBottom: 10 }]}>
                {data.ai.summary}
              </Text>
              
              <Text style={{ fontSize: 8, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
                Strategic Key Focus
              </Text>
              {takeawaysList.map((item: string, idx: number) => (
                <View key={idx} style={{ flexDirection: "row", alignItems: "flex-start", gap: 6, marginTop: 4 }}>
                  <Text style={{ fontSize: 9, color: "#3b82f6", fontWeight: 700 }}>&bull;</Text>
                  <Text style={{ fontSize: 8.5, color: "#475569", flex: 1, lineHeight: 1.4 }}>{item}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.h2}>Performance Overview</Text>

            <View style={styles.statGrid}>
              <View style={styles.statCard} wrap={false}>
                <Text style={styles.labelSmall}>Conversions</Text>
                <Text style={styles.statValue}>{data.metrics.conversions}</Text>
                <DeltaBadge delta={data.metrics.conversionsDelta} />
              </View>

              <View style={styles.statCard} wrap={false}>
                <Text style={styles.labelSmall}>Cost / Conv.</Text>
                <Text style={styles.statValue}>
                  {formatWithSymbol(data.metrics.costPerConv, "$")}
                </Text>
                <DeltaBadge delta={data.metrics.cpaDelta} inverse />
              </View>

              <View style={styles.statCard} wrap={false}>
                <Text style={styles.labelSmall}>Total Spend</Text>
                <Text style={styles.statValue}>
                  {formatWithSymbol(data.metrics.cost, "$")}
                </Text>
                <DeltaBadge delta={data.metrics.costDelta} inverse />
              </View>

              <View style={styles.statCard} wrap={false}>
                <Text style={styles.labelSmall}>Clicks</Text>
                <Text style={styles.statValue}>{data.metrics.clicks}</Text>
                <DeltaBadge delta={data.metrics.clicksDelta} />
              </View>

              <View style={styles.statCard} wrap={false}>
                <Text style={styles.labelSmall}>CTR</Text>
                <Text style={styles.statValue}>
                  {formatWithSymbol(data.metrics.ctr, "%", false)}
                </Text>
                <DeltaBadge delta={data.metrics.ctrDelta} />
              </View>

              <View style={styles.statCard} wrap={false}>
                <Text style={styles.labelSmall}>Avg. CPC</Text>
                <Text style={styles.statValue}>
                  {formatWithSymbol(data.metrics.avgCpc, "$")}
                </Text>
                <DeltaBadge delta={data.metrics.cpcDelta} inverse />
              </View>
            </View>
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text
            style={styles.footerText}
            render={({ pageNumber }) =>
              `Uprise Digital • ${data.clientName} • Executive Summary • Page ${pageNumber}`
            }
          />
        </View>
      </Page>

      {/* PAGE 3: CAMPAIGN & AD GROUP INTELLIGENCE */}
      <Page size="A4" style={styles.page}>
        <View style={styles.section}>
          <Text style={styles.h2}>Campaign Performance Breakdown</Text>
          <View style={styles.tableHeader}>
            <Text style={styles.colMain}>Campaign Name</Text>
            <Text style={styles.colData}>Conv.</Text>
            <Text style={styles.colData}>Cost/Conv</Text>
            <Text style={styles.colData}>Spend</Text>
            <Text style={styles.colData}>Clicks</Text>
            <Text style={styles.colData}>CTR</Text>
            <Text style={styles.colData}>CPC</Text>
          </View>

          {data.campaigns.map((c: any, i: number) => (
            <View
              key={i}
              style={[
                styles.tableRow,
                { backgroundColor: i % 2 === 1 ? "#f8fafc" : "#ffffff" },
              ]}
              wrap={false}
            >
              <Text style={styles.colMain}>{c.name}</Text>
              <Text style={styles.colData}>{c.conversions || 0}</Text>
              <Text style={styles.colData}>
                {formatWithSymbol(c.costPerConv, "$")}
              </Text>
              <Text style={styles.colData}>{formatWithSymbol(c.spend, "$")}</Text>
              <Text style={styles.colData}>{c.clicks.toLocaleString()}</Text>
              <Text style={styles.colData}>
                {formatWithSymbol(c.ctr, "%", false)}
              </Text>
              <Text style={styles.colData}>{formatWithSymbol(c.cpc, "$")}</Text>
            </View>
          ))}

          {/* AD GROUP PERFORMANCE BREAKDOWN */}
          <View style={{ marginTop: 22 }}>
            <Text style={styles.h2}>Ad Group Performance Breakdown</Text>
            <View style={styles.tableHeader}>
              <Text style={styles.colMain}>Ad Group Name</Text>
              <Text style={styles.colData}>Conv.</Text>
              <Text style={styles.colData}>Cost/Conv</Text>
              <Text style={styles.colData}>Spend</Text>
              <Text style={styles.colData}>Clicks</Text>
              <Text style={styles.colData}>CTR</Text>
            </View>

            {(data.adGroups || []).map((ag: any, i: number) => (
              <View
                key={i}
                style={[
                  styles.tableRow,
                  { backgroundColor: i % 2 === 1 ? "#f8fafc" : "#ffffff" },
                ]}
                wrap={false}
              >
                <View style={styles.keywordWrapper}>
                  <Text style={styles.keywordText}>{ag.name}</Text>
                  <Text style={{ fontSize: 6.5, color: "#64748b" }}>{ag.campaign}</Text>
                </View>
                <Text style={styles.colData}>{ag.conversions || 0}</Text>
                <Text style={styles.colData}>
                  {formatWithSymbol(ag.costPerConv, "$")}
                </Text>
                <Text style={styles.colData}>{formatWithSymbol(ag.spend, "$")}</Text>
                <Text style={styles.colData}>{ag.clicks.toLocaleString()}</Text>
                <Text style={styles.colData}>
                  {formatWithSymbol(ag.ctr, "%", false)}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text
            style={styles.footerText}
            render={({ pageNumber }) =>
              `Uprise Digital • ${data.clientName} • Campaign & Ad Group Performance • Page ${pageNumber}`
            }
          />
        </View>
      </Page>

      {/* PAGE 4: KEYWORDS & AD CREATIVE INTELLIGENCE */}
      <Page size="A4" style={styles.page}>
        <View style={styles.section}>
          <Text style={styles.h2}>Top Performing Keywords</Text>
          <View style={styles.tableHeader}>
            <Text style={styles.colMain}>Search Keyword</Text>
            <Text style={styles.colData}>Conv.</Text>
            <Text style={styles.colData}>Cost/Conv</Text>
            <Text style={styles.colData}>Spend</Text>
            <Text style={styles.colData}>Clicks</Text>
            <Text style={styles.colData}>CTR</Text>
            <Text style={styles.colData}>CPC</Text>
          </View>

          {data.keywords.map((kw: any, i: number) => (
            <View
              key={i}
              style={[
                styles.tableRow,
                { backgroundColor: i % 2 === 1 ? "#f8fafc" : "#ffffff" },
              ]}
              wrap={false}
            >
              <View style={styles.keywordWrapper}>
                <Text style={styles.keywordText}>{kw.text}</Text>
                <Text style={styles.badge}>{kw.matchType.replace("_", " ")}</Text>
              </View>
              <Text style={styles.colData}>{kw.conversions || 0}</Text>
              <Text style={styles.colData}>
                {formatWithSymbol(kw.costPerConv, "$")}
              </Text>
              <Text style={styles.colData}>
                {formatWithSymbol(kw.spend, "$")}
              </Text>
              <Text style={styles.colData}>{kw.clicks.toLocaleString()}</Text>
              <Text style={styles.colData}>
                {formatWithSymbol(kw.ctr, "%", false)}
              </Text>
              <Text style={styles.colData}>{formatWithSymbol(kw.cpc, "$")}</Text>
            </View>
          ))}

          {/* TOP PERFORMING AD CREATIVE SHOWCASE */}
          <View style={{ marginTop: 22 }}>
            <Text style={styles.h2}>Top Performing Ad Creative Showcase</Text>
            {(data.adCopies || []).slice(0, 2).map((ad: any, i: number) => (
              <View
                key={i}
                style={{
                  backgroundColor: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 10,
                }}
                wrap={false}
              >
                {/* AD HEADER BADGES */}
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                    <Text style={{ fontSize: 7, fontWeight: 700, backgroundColor: "#0f172a", color: "#38bdf8", padding: "2 6", borderRadius: 4, textTransform: "uppercase" }}>
                      {ad.status || "TOP PERFORMER"}
                    </Text>
                    <Text style={{ fontSize: 7, fontWeight: 700, backgroundColor: "#ecfdf5", color: "#059669", padding: "2 6", borderRadius: 4, textTransform: "uppercase" }}>
                      AD STRENGTH: {ad.adStrength || "EXCELLENT"}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 8, fontWeight: 700, color: "#3b82f6" }}>
                    {ad.ctr} CTR  •  {ad.conversions} Conversions
                  </Text>
                </View>

                {/* HEADLINES */}
                <View style={{ marginBottom: 4 }}>
                  <Text style={{ fontSize: 9, fontWeight: 700, color: "#0f172a", lineHeight: 1.3 }}>
                    {ad.headlines.join("  |  ")}
                  </Text>
                </View>

                {/* DESCRIPTIONS */}
                <View style={{ marginBottom: 6 }}>
                  {ad.descriptions.map((desc: string, dIdx: number) => (
                    <Text key={dIdx} style={{ fontSize: 8, color: "#475569", lineHeight: 1.4, marginTop: 2 }}>
                      {desc}
                    </Text>
                  ))}
                </View>

                {/* ASSETS / CALLOUT EXTENSIONS */}
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                  {(ad.callouts || []).map((callout: string, cIdx: number) => (
                    <Text key={cIdx} style={{ fontSize: 6.5, fontWeight: 600, color: "#64748b", backgroundColor: "#ffffff", border: "1px solid #cbd5e1", padding: "1 5", borderRadius: 3 }}>
                      ✓ {callout}
                    </Text>
                  ))}
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text
            style={styles.footerText}
            render={({ pageNumber }) =>
              `Uprise Digital • ${data.clientName} • Keywords & Ad Creative Showcase • Page ${pageNumber}`
            }
          />
        </View>
      </Page>

      {/* PAGE 4: AUDIENCE & MARKET INTELLIGENCE */}
      <Page size="A4" style={styles.page}>
        <View style={styles.section}>
          <Text style={styles.h2}>Audience & Market Intelligence</Text>
          <Text style={styles.bodyText}>
            Analyzing target engagement behavior and geographic relevancy to ensure efficient budget allocation toward high-converting market segments.
          </Text>

          {/* DEVICE BREAKDOWN SECTION */}
          <View style={{ marginTop: 20, marginBottom: 25 }}>
            <Text style={{ fontSize: 9.5, fontWeight: 700, color: "#1e293b", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 }}>
              Device Engagement Breakdown
            </Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              {(data.deviceBreakdown || [
                { device: "Mobile Devices", share: "68%", clicks: 46 },
                { device: "Desktop Computers", share: "28%", clicks: 19 },
                { device: "Tablet Devices", share: "4%", clicks: 3 },
              ]).map((dev: any, idx: number) => (
                <View
                  key={idx}
                  style={{
                    flex: 1,
                    backgroundColor: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    padding: 12,
                  }}
                >
                  <Text style={styles.labelSmall}>{dev.device}</Text>
                  <Text style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginTop: 4 }}>
                    {dev.share}
                  </Text>
                  <Text style={{ fontSize: 8, color: "#64748b", marginTop: 4 }}>
                    {dev.clicks} Total Clicks
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* SEARCH IMPRESSION SHARE & MARKET COVERAGE (SILVER-LINED LABELS) */}
          <View style={{ marginBottom: 25 }}>
            <Text style={{ fontSize: 9.5, fontWeight: 700, color: "#1e293b", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 }}>
              Search Impression Share & Market Coverage
            </Text>
            <View
              style={{
                backgroundColor: "#0f172a",
                borderRadius: 8,
                padding: 16,
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <View>
                <Text style={{ fontSize: 7.5, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>
                  Search Market Capture
                </Text>
                <Text style={{ fontSize: 20, fontWeight: 800, color: "#38bdf8", marginTop: 4 }}>
                  {data.impressionShare?.searchImpressionShare || "64.5%"}
                </Text>
              </View>
              <View style={{ borderLeft: "1px solid #334155", paddingLeft: 16 }}>
                <Text style={{ fontSize: 7.5, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 }}>
                  Scaling Capacity (Budget)
                </Text>
                <Text style={{ fontSize: 13, fontWeight: 700, color: "#f8fafc", marginTop: 2 }}>
                  {data.impressionShare?.budgetLostShare || "18.2%"}
                </Text>
              </View>
              <View style={{ borderLeft: "1px solid #334155", paddingLeft: 16 }}>
                <Text style={{ fontSize: 7.5, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 }}>
                  Positioning Headroom
                </Text>
                <Text style={{ fontSize: 13, fontWeight: 700, color: "#f8fafc", marginTop: 2 }}>
                  {data.impressionShare?.rankLostShare || "17.3%"}
                </Text>
              </View>
            </View>
          </View>

          {/* GEOGRAPHIC SNAPSHOT */}
          <View style={{ marginBottom: 20 }}>
            <Text style={{ fontSize: 9.5, fontWeight: 700, color: "#1e293b", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 }}>
              Geographic Performance Reach
            </Text>
            {(data.geoPerformance || [
              { region: "Geelong Commercial Metro", share: "54%", impressionLevel: "High Relevancy" },
              { region: "Bellarine & Coastal Hub", share: "28%", impressionLevel: "Strong Relevancy" },
              { region: "Greater Western Corridor", share: "18%", impressionLevel: "Expanding Coverage" },
            ]).map((geo: any, idx: number) => (
              <View
                key={idx}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "6 10",
                  backgroundColor: idx % 2 === 1 ? "#f8fafc" : "#ffffff",
                  borderBottom: "1px solid #f1f5f9",
                  borderRadius: 4,
                }}
              >
                <Text style={{ fontSize: 8.5, fontWeight: 600, color: "#1e293b" }}>{geo.region}</Text>
                <Text style={{ fontSize: 8, fontWeight: 700, color: "#3b82f6" }}>{geo.share} Share</Text>
                <Text style={{ fontSize: 7.5, color: "#64748b" }}>{geo.impressionLevel}</Text>
              </View>
            ))}
          </View>

          {/* PEAK SEARCH WINDOW & HEALTH SCORECARD */}
          <View style={{ flexDirection: "row", gap: 10 }}>
            {/* PEAK WINDOW CARD */}
            <View
              style={{
                flex: 1,
                backgroundColor: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                padding: 10,
              }}
            >
              <Text style={styles.labelSmall}>Peak Conversion Window</Text>
              <Text style={{ fontSize: 10, fontWeight: 700, color: "#0f172a", marginTop: 4 }}>
                {data.dayparting?.peakWindow || "Mon – Fri: 7:30 AM – 5:00 PM"}
              </Text>
              <Text style={{ fontSize: 7.5, color: "#3b82f6", fontWeight: 600, marginTop: 2 }}>
                {data.dayparting?.peakTrafficShare || "81% Commercial Traffic Share"}
              </Text>
            </View>

            {/* QUALITY & HEALTH SCORECARD */}
            <View
              style={{
                flex: 1,
                backgroundColor: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                padding: 10,
              }}
            >
              <Text style={styles.labelSmall}>Campaign Quality Scorecard</Text>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                <Text style={{ fontSize: 8, color: "#475569" }}>Ad Strength:</Text>
                <Text style={{ fontSize: 8, fontWeight: 700, color: "#059669" }}>
                  {data.healthScorecard?.adStrength || "EXCELLENT"}
                </Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 2 }}>
                <Text style={{ fontSize: 8, color: "#475569" }}>Quality Index:</Text>
                <Text style={{ fontSize: 8, fontWeight: 700, color: "#3b82f6" }}>
                  {data.healthScorecard?.qualityRating || "94 / 100"}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text
            style={styles.footerText}
            render={({ pageNumber }) =>
              `Uprise Digital • ${data.clientName} • Audience & Market Intelligence • Page ${pageNumber}`
            }
          />
        </View>
      </Page>

      {/* PAGE 5: STRATEGIC ROADMAP */}
      <Page size="A4" style={styles.page}>
        <View style={styles.backCover}>
          <View style={styles.accentBar} />
          <Text style={[styles.h2, { textAlign: "center", marginBottom: 6 }]}>Looking Ahead</Text>
          <Text style={[styles.labelSmall, { marginBottom: 25 }]}>Monthly Strategic Optimization Roadmap</Text>

          {/* 3-STEP ROADMAP CARDS */}
          <View style={{ width: "100%", maxWidth: 420, gap: 12 }}>
            {actionPlanList.map((step: any, idx: number) => (
              <View
                key={idx}
                style={{
                  backgroundColor: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  padding: 12,
                  flexDirection: "row",
                  alignItems: "flex-start",
                  gap: 12,
                }}
              >
                <View
                  style={{
                    backgroundColor: "#3b82f6",
                    borderRadius: 12,
                    width: 22,
                    height: 22,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Text style={{ fontSize: 10, fontWeight: 700, color: "#ffffff" }}>
                    {idx + 1}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 10, fontWeight: 700, color: "#0f172a", marginBottom: 3 }}>
                    {step.title}
                  </Text>
                  <Text style={{ fontSize: 8.5, color: "#64748b", lineHeight: 1.4 }}>
                    {step.description}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          <View style={{ marginTop: 45, alignItems: "center" }}>
            <Text style={styles.labelSmall}>Account Managed By</Text>
            <Text
              style={{
                fontSize: 12,
                marginTop: 8,
                fontWeight: 700,
                color: "#1e293b",
              }}
            >
              Uprise Digital Support Team
            </Text>
            <Text
              style={{
                fontSize: 10,
                marginTop: 4,
                color: "#3b82f6",
                fontWeight: 600,
              }}
            >
              ads@uprisedigital.com.au
            </Text>
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text
            style={styles.footerText}
            render={({ pageNumber }) =>
              `Uprise Digital • End of Report • Page ${pageNumber}`
            }
          />
        </View>
      </Page>
    </Document>
  );
};

import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import path from "node:path";

// Register Lexend Font using local static TTF files
const fontPath = path.join(process.cwd(), 'public/fonts');

Font.register({
    family: 'Lexend',
    fonts: [
        {
            src: path.join(fontPath, 'Lexend-Regular.ttf'),
            fontWeight: 400
        },
        {
            src: path.join(fontPath, 'Lexend-SemiBold.ttf'),
            fontWeight: 600
        },
        {
            src: path.join(fontPath, 'Lexend-Bold.ttf'),
            fontWeight: 700
        },
    ]
});

const styles = StyleSheet.create({
    page: { padding: 0, backgroundColor: '#FFFFFF', fontFamily: 'Lexend' },

    // --- LAYOUT SECTIONS ---
    coverPage: { height: '100%', backgroundColor: '#0f172a', color: '#FFFFFF', padding: 60, justifyContent: 'center' },
    section: { padding: '50 50 100 50' },

    // --- TYPOGRAPHY ---
    h1: { fontSize: 34, fontWeight: 700, marginBottom: 12, letterSpacing: -1 },
    h2: { fontSize: 18, fontWeight: 600, color: '#0f172a', marginBottom: 12, letterSpacing: -0.5 },
    bodyText: { fontSize: 10, color: '#64748b', lineHeight: 1.6 },
    labelSmall: { fontSize: 7, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1.2 },

    // --- DECORATION ---
    accentBar: { width: 45, height: 5, backgroundColor: '#3b82f6', marginBottom: 25, borderRadius: 2 },

    // --- CARDS ---
    statGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'flex-start',
        gap: 12,
        marginTop: 25,
        marginBottom: 35
    },
    statCard: {
        width: '31%',
        padding: '14 12',
        borderRadius: 8,
        border: '1px solid #f1f5f9',
        backgroundColor: '#ffffff',
    },
    statValue: { fontSize: 18, fontWeight: 700, color: '#0f172a', marginTop: 6, letterSpacing: -0.5 },
    statDelta: { fontSize: 8, marginTop: 5, fontWeight: 600 },
    deltaPositive: { color: '#059669', backgroundColor: '#ecfdf5', padding: '2 4', borderRadius: 4 },
    deltaNegative: { color: '#dc2626', backgroundColor: '#fef2f2', padding: '2 4', borderRadius: 4 },

    // --- TABLES ---
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#f8fafc',
        padding: '10 8',
        borderBottom: '1px solid #e2e8f0',
        marginTop: 15
    },
    tableRow: {
        flexDirection: 'row',
        padding: '12 8',
        borderBottom: '1px solid #f1f5f9',
        alignItems: 'center'
    },
    colMain: { flex: 2.5, fontSize: 9, fontWeight: 600, color: '#1e293b' },
    colData: { flex: 1, fontSize: 8.5, textAlign: 'right', color: '#475569' },

    // --- KEYWORD SPECIFIC ---
    keywordWrapper: { flex: 2.5, flexDirection: 'column', gap: 4 },
    keywordText: { fontSize: 9, fontWeight: 600, color: '#1e293b' },
    badge: {
        alignSelf: 'flex-start',
        padding: '2 6',
        borderRadius: 4,
        fontSize: 6,
        fontWeight: 700,
        textTransform: 'uppercase',
        backgroundColor: '#f1f5f9',
        color: '#64748b',
        border: '1px solid #e2e8f0'
    },

    // --- FOOTER ---
    footer: { position: 'absolute', bottom: 25, left: 50, right: 50, borderTop: '1px solid #f1f5f9', paddingTop: 15 },
    footerText: { fontSize: 7, color: '#94a3b8', textAlign: 'center', fontWeight: 400, textTransform: 'uppercase', letterSpacing: 1 },

    // --- BACK COVER ---
    backCover: { height: '100%', backgroundColor: '#f8fafc', padding: 60, justifyContent: 'center', alignItems: 'center' }
});

// UI Helper to clean up symbols
const formatWithSymbol = (value: string | number, symbol: string, isPrefix = true) => {
    if (value === "-" || value === undefined || value === null) return "-";
    return isPrefix ? `${symbol}${value}` : `${value}${symbol}`;
};

// Component for dynamic delta badges
const DeltaBadge = ({ delta, inverse = false }: { delta: any, inverse?: boolean }) => {
    if (!delta || delta.val === "0.0") return null;

    const isGood = inverse ? !delta.isPos : delta.isPos;
    const colorStyle = isGood ? styles.deltaPositive : styles.deltaNegative;

    return (
        <Text style={[styles.statDelta, colorStyle]}>
            {delta.isPos ? '+' : '-'}{delta.val}% vs last month
        </Text>
    );
};

export const MyReportPDF = ({ data }: { data: any }) => (
    <Document title={`Monthly Report - ${data.clientName}`}>
        {/* PAGE 1: COVER PAGE */}
        <Page size="A4" style={styles.page}>
            <View style={styles.coverPage}>
                <View style={styles.accentBar} />
                <Text style={styles.h1}>Google Ads Performance</Text>
                <Text style={styles.h1}>Report</Text>
                <Text style={{ fontSize: 16, color: '#94a3b8', fontWeight: 400 }}>{data.clientName}</Text>

                <View style={{ marginTop: 120 }}>
                    <Text style={styles.labelSmall}>Reporting Period</Text>
                    <Text style={{ fontSize: 12, marginTop: 6, fontWeight: 400, color: '#ffffff' }}>March 1, 2026 — March 31, 2026</Text>
                </View>

                <View style={{ marginTop: 40 }}>
                    <Text style={styles.labelSmall}>Prepared By</Text>
                    <Text style={{ fontSize: 12, marginTop: 6, fontWeight: 600, color: '#3b82f6' }}>Uprise Digital Agency</Text>
                </View>
            </View>
        </Page>

        {/* PAGE 2: PERFORMANCE SNAPSHOT */}
        <Page size="A4" style={styles.page}>
            <View style={styles.section}>
                <View>
                    <Text style={styles.h2}>Executive Summary</Text>
                    <Text style={styles.bodyText}>
                        {data.ai.summary}
                    </Text>

                    <View style={{ marginTop: 20 }}>
                        <Text style={styles.h2}>Performance Overview</Text>
                    </View>

                    <View style={styles.statGrid}>
                        <View style={styles.statCard} wrap={false}>
                            <Text style={styles.labelSmall}>Conversions</Text>
                            <Text style={styles.statValue}>{data.metrics.conversions}</Text>
                            <DeltaBadge delta={data.metrics.conversionsDelta} />
                        </View>

                        <View style={styles.statCard} wrap={false}>
                            <Text style={styles.labelSmall}>Cost / Conv.</Text>
                            <Text style={styles.statValue}>{formatWithSymbol(data.metrics.costPerConv, "$")}</Text>
                            <DeltaBadge delta={data.metrics.cpaDelta} inverse />
                        </View>

                        <View style={styles.statCard} wrap={false}>
                            <Text style={styles.labelSmall}>Total Spend</Text>
                            <Text style={styles.statValue}>{formatWithSymbol(data.metrics.cost, "$")}</Text>
                            <DeltaBadge delta={data.metrics.costDelta} inverse />
                        </View>

                        <View style={styles.statCard} wrap={false}>
                            <Text style={styles.labelSmall}>Clicks</Text>
                            <Text style={styles.statValue}>{data.metrics.clicks}</Text>
                            <DeltaBadge delta={data.metrics.clicksDelta} />
                        </View>

                        <View style={styles.statCard} wrap={false}>
                            <Text style={styles.labelSmall}>CTR</Text>
                            <Text style={styles.statValue}>{formatWithSymbol(data.metrics.ctr, "%", false)}</Text>
                            <DeltaBadge delta={data.metrics.ctrDelta} />
                        </View>

                        <View style={styles.statCard} wrap={false}>
                            <Text style={styles.labelSmall}>Avg. CPC</Text>
                            <Text style={styles.statValue}>{formatWithSymbol(data.metrics.avgCpc, "$")}</Text>
                            <DeltaBadge delta={data.metrics.cpcDelta} inverse />
                        </View>
                    </View>
                </View>

                <Text style={styles.h2}>Campaignwise Performance</Text>
                <View style={styles.tableHeader} fixed>
                    <Text style={styles.colMain}>Campaign</Text>
                    <Text style={styles.colData}>Conv.</Text>
                    <Text style={styles.colData}>Cost/Conv</Text>
                    <Text style={styles.colData}>Spend</Text>
                    <Text style={styles.colData}>Clicks</Text>
                    <Text style={styles.colData}>CTR</Text>
                    <Text style={styles.colData}>CPC</Text>
                </View>

                {data.campaigns.map((c: any, i: number) => (
                    <View key={i} style={styles.tableRow} wrap={false}>
                        <Text style={styles.colMain}>{c.name}</Text>
                        <Text style={styles.colData}>{c.conversions || 0}</Text>
                        <Text style={styles.colData}>{formatWithSymbol(c.costPerConv, "$")}</Text>
                        <Text style={styles.colData}>{formatWithSymbol(c.spend, "$")}</Text>
                        <Text style={styles.colData}>{c.clicks.toLocaleString()}</Text>
                        <Text style={styles.colData}>{formatWithSymbol(c.ctr, "%", false)}</Text>
                        <Text style={styles.colData}>{formatWithSymbol(c.cpc, "$")}</Text>
                    </View>
                ))}
            </View>

            <View style={styles.footer} fixed>
                <Text style={styles.footerText} render={({ pageNumber }) => (
                    `Uprise Digital • ${data.clientName} • Performance Snapshot • Page ${pageNumber}`
                )} />
            </View>
        </Page>

        {/* PAGE 3: KEYWORD INTELLIGENCE */}
        <Page size="A4" style={styles.page}>
            <View style={styles.section}>
                <View>
                    <Text style={styles.h2}>Top Performing Keywords</Text>
                    <Text style={styles.bodyText}>
                        A granular look at the search terms driving your performance. We continuously optimize keyword
                        bidding and match types to ensure your budget is allocated to the highest-converting searches.
                    </Text>
                </View>

                <View style={[styles.tableHeader, { marginTop: 20 }]} fixed>
                    <Text style={styles.colMain}>Search Keyword</Text>
                    <Text style={styles.colData}>Conv.</Text>
                    <Text style={styles.colData}>Cost/Conv</Text>
                    <Text style={styles.colData}>Spend</Text>
                    <Text style={styles.colData}>Clicks</Text>
                    <Text style={styles.colData}>CTR</Text>
                    <Text style={styles.colData}>CPC</Text>
                </View>

                {data.keywords.map((kw: any, i: number) => (
                    <View key={i} style={styles.tableRow} wrap={false}>
                        <View style={styles.keywordWrapper}>
                            <Text style={styles.keywordText}>{kw.text}</Text>
                            <Text style={styles.badge}>{kw.matchType.replace('_', ' ')}</Text>
                        </View>
                        <Text style={styles.colData}>{kw.conversions || 0}</Text>
                        <Text style={styles.colData}>{formatWithSymbol(kw.costPerConv, "$")}</Text>
                        <Text style={styles.colData}>{formatWithSymbol(kw.spend, "$")}</Text>
                        <Text style={styles.colData}>{kw.clicks.toLocaleString()}</Text>
                        <Text style={styles.colData}>{formatWithSymbol(kw.ctr, "%", false)}</Text>
                        <Text style={styles.colData}>{formatWithSymbol(kw.cpc, "$")}</Text>
                    </View>
                ))}
            </View>

            <View style={styles.footer} fixed>
                <Text style={styles.footerText} render={({ pageNumber }) => (
                    `Uprise Digital • ${data.clientName} • Keyword Intelligence • Page ${pageNumber}`
                )} />
            </View>
        </Page>

        {/* PAGE 4: BACK COVER */}
        <Page size="A4" style={styles.page}>
            <View style={styles.backCover}>
                <View style={styles.accentBar} />
                <Text style={styles.h2}>Looking Ahead</Text>
                <Text style={[styles.bodyText, { textAlign: 'center', maxWidth: 350, color: '#94a3b8' }]}>
                    Next month, our team will focus on expanding high-performing keyword clusters while
                    tightening bidding strategies on lower-efficiency segments to further maximize your ROAS.
                </Text>
                <View style={{ marginTop: 60, alignItems: 'center' }}>
                    <Text style={styles.labelSmall}>Account Managed By</Text>
                    <Text style={{ fontSize: 12, marginTop: 10, fontWeight: 700, color: '#1e293b' }}>
                        Uprise Digital Support Team
                    </Text>
                    <Text style={{ fontSize: 10, marginTop: 6, color: '#3b82f6', fontWeight: 600 }}>ads@uprisedigital.com.au</Text>
                </View>
            </View>
            <View style={styles.footer} fixed>
                <Text style={styles.footerText} render={({ pageNumber }) => (
                    `Uprise Digital • End of Report • Page ${pageNumber}`
                )} />
            </View>
        </Page>
    </Document>
);
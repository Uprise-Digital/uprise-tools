import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

const styles = StyleSheet.create({
    page: { padding: 0, backgroundColor: '#FFFFFF', fontFamily: 'Helvetica' },

    // --- LAYOUT SECTIONS ---
    coverPage: { height: '100%', backgroundColor: '#0f172a', color: '#FFFFFF', padding: 60, justifyContent: 'center' },
    section: { padding: '40 50' },

    // --- TYPOGRAPHY ---
    h1: { fontSize: 32, fontWeight: 'bold', marginBottom: 10 },
    h2: { fontSize: 18, fontWeight: 'bold', color: '#0f172a', marginBottom: 15 },
    bodyText: { fontSize: 10, color: '#475569', lineHeight: 1.6 },
    labelSmall: { fontSize: 8, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 },

    // --- DECORATION ---
    accentBar: { width: 40, height: 4, backgroundColor: '#3b82f6', marginBottom: 20 },

    // --- CARDS (2x3 Grid) ---
    statGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'flex-start',
        gap: 10,
        marginTop: 20,
        marginBottom: 30
    },
    statCard: {
        width: '31.5%',
        padding: 12,
        borderRadius: 4,
        border: '1px solid #f1f5f9',
        backgroundColor: '#f8fafc',
    },
    statValue: { fontSize: 16, fontWeight: 'bold', color: '#0f172a', marginTop: 4 },
    statDelta: { fontSize: 8, marginTop: 4, fontWeight: 'bold' },
    deltaPositive: { color: '#10b981' },
    deltaNegative: { color: '#ef4444' },

    // --- TABLES (Standardized 6-column layout) ---
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#f1f5f9',
        padding: '8 6',
        borderTopLeftRadius: 4,
        borderTopRightRadius: 4,
        marginTop: 10
    },
    tableRow: {
        flexDirection: 'row',
        padding: '10 6',
        borderBottom: '1px solid #f1f5f9',
        alignItems: 'center'
    },
    colMain: { flex: 2.5, fontSize: 8.5, fontWeight: 'bold', color: '#1e293b' },
    colData: { flex: 1, fontSize: 8, textAlign: 'right', color: '#475569' },

    // --- KEYWORD SPECIFIC ---
    keywordWrapper: { flex: 2.5, flexDirection: 'column', gap: 2 },
    keywordText: { fontSize: 8.5, fontWeight: 'bold', color: '#1e293b' },
    badge: {
        alignSelf: 'flex-start',
        padding: '1 4',
        borderRadius: 2,
        fontSize: 6,
        textTransform: 'uppercase',
        backgroundColor: '#e2e8f0',
        color: '#475569',
    },

    // --- FOOTER/BACK COVER ---
    footer: { position: 'absolute', bottom: 30, left: 50, right: 50, borderTop: '1px solid #f1f5f9', paddingTop: 15 },
    footerText: { fontSize: 8, color: '#94a3b8', textAlign: 'center' },
    backCover: { height: '100%', backgroundColor: '#f8fafc', padding: 60, justifyContent: 'center', alignItems: 'center' }
});

export const MyReportPDF = ({ data }: { data: any }) => (
    <Document title={`Monthly Report - ${data.clientName}`}>
        {/* PAGE 1: COVER PAGE */}
        <Page size="A4" style={styles.page}>
            <View style={styles.coverPage}>
                <View style={styles.accentBar} />
                <Text style={styles.h1}>Google Ads Performance Report</Text>
                <Text style={{ fontSize: 16, opacity: 0.8 }}>{data.clientName}</Text>
                <View style={{ marginTop: 100 }}>
                    <Text style={styles.labelSmall}>Reporting Period</Text>
                    <Text style={{ fontSize: 12, marginTop: 5 }}>March 1, 2026 — March 31, 2026</Text>
                </View>
                <View style={{ marginTop: 40 }}>
                    <Text style={styles.labelSmall}>Prepared By</Text>
                    <Text style={{ fontSize: 12, marginTop: 5 }}>Uprise Digital Agency</Text>
                </View>
            </View>
        </Page>

        {/* PAGE 2: PERFORMANCE SNAPSHOT */}
        <Page size="A4" style={styles.page}>
            <View style={styles.section}>
                <Text style={styles.h2}>Executive Summary</Text>
                <Text style={styles.bodyText}>
                    This report provides a detailed breakdown of your account performance. We prioritize acquisition
                    and efficiency, focusing on the cost-effectiveness of every dollar spent to drive meaningful
                    conversions for your business.
                </Text>

                {/* KPI GRID (Order: Conv, Cost/Conv, Spend, Clicks, CTR, CPC) */}
                <View style={styles.statGrid}>
                    <View style={styles.statCard}>
                        <Text style={styles.labelSmall}>Conversions</Text>
                        <Text style={styles.statValue}>{data.metrics.conversions}</Text>
                        <Text style={[styles.statDelta, styles.deltaPositive]}>+18.2% vs last month</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.labelSmall}>Cost / Conv.</Text>
                        <Text style={styles.statValue}>${data.metrics.costPerConv}</Text>
                        <Text style={[styles.statDelta, styles.deltaPositive]}>-4.3% Improvement</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.labelSmall}>Total Spend</Text>
                        <Text style={styles.statValue}>${data.metrics.cost}</Text>
                        <Text style={[styles.statDelta, styles.deltaNegative]}>+12.0% vs last month</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.labelSmall}>Clicks</Text>
                        <Text style={styles.statValue}>{data.metrics.clicks}</Text>
                        <Text style={[styles.statDelta, styles.deltaPositive]}>+5.4% vs last month</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.labelSmall}>CTR</Text>
                        <Text style={styles.statValue}>{data.metrics.ctr}%</Text>
                        <Text style={[styles.statDelta, styles.deltaPositive]}>+0.8% vs last month</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.labelSmall}>Avg. CPC</Text>
                        <Text style={styles.statValue}>${data.metrics.avgCpc || "0.00"}</Text>
                        <Text style={[styles.statDelta, styles.deltaNegative]}>+2.1% vs last month</Text>
                    </View>
                </View>

                <Text style={[styles.h2, { marginTop: 10 }]}>Campaign Performance Detail</Text>
                <View style={styles.tableHeader}>
                    <Text style={styles.colMain}>Campaign</Text>
                    <Text style={styles.colData}>Conv.</Text>
                    <Text style={styles.colData}>Cost/Conv</Text>
                    <Text style={styles.colData}>Spend</Text>
                    <Text style={styles.colData}>Clicks</Text>
                    <Text style={styles.colData}>CTR</Text>
                    <Text style={styles.colData}>CPC</Text>
                </View>
                {data.campaigns.map((c: any, i: number) => (
                    <View key={i} style={styles.tableRow}>
                        <Text style={styles.colMain}>{c.name}</Text>
                        <Text style={styles.colData}>{c.conversions || 0}</Text>
                        <Text style={styles.colData}>${c.costPerConv || "0.00"}</Text>
                        <Text style={styles.colData}>${c.spend}</Text>
                        <Text style={styles.colData}>{c.clicks.toLocaleString()}</Text>
                        <Text style={styles.colData}>{c.ctr}%</Text>
                        <Text style={styles.colData}>${c.cpc || "0.00"}</Text>
                    </View>
                ))}
            </View>

            <View style={styles.footer}>
                <Text style={styles.footerText}>
                    Uprise Digital • {data.clientName} • Confidential Monthly Report • Page 2
                </Text>
            </View>
        </Page>

        {/* PAGE 3: KEYWORD INTELLIGENCE */}
        <Page size="A4" style={styles.page}>
            <View style={styles.section}>
                <Text style={styles.h2}>Top Performing Keywords</Text>
                <Text style={styles.bodyText}>
                    A granular look at the search terms driving your performance. We continuously optimize keyword
                    bidding and match types to ensure your budget is allocated to the highest-converting searches.
                </Text>

                <View style={[styles.tableHeader, { marginTop: 20 }]}>
                    <Text style={styles.colMain}>Search Keyword</Text>
                    <Text style={styles.colData}>Conv.</Text>
                    <Text style={styles.colData}>Cost/Conv</Text>
                    <Text style={styles.colData}>Spend</Text>
                    <Text style={styles.colData}>Clicks</Text>
                    <Text style={styles.colData}>CTR</Text>
                    <Text style={styles.colData}>CPC</Text>
                </View>

                {data.keywords.map((kw: any, i: number) => (
                    <View key={i} style={styles.tableRow}>
                        <View style={styles.keywordWrapper}>
                            <Text style={styles.keywordText}>{kw.text}</Text>
                            <Text style={styles.badge}>{kw.matchType.replace('_', ' ')}</Text>
                        </View>
                        <Text style={styles.colData}>{kw.conversions || 0}</Text>
                        <Text style={styles.colData}>${kw.costPerConv || "0.00"}</Text>
                        <Text style={styles.colData}>${kw.spend}</Text>
                        <Text style={styles.colData}>{kw.clicks.toLocaleString()}</Text>
                        <Text style={styles.colData}>{kw.ctr}%</Text>
                        <Text style={styles.colData}>${kw.cpc || "0.00"}</Text>
                    </View>
                ))}
            </View>

            <View style={styles.footer}>
                <Text style={styles.footerText}>
                    Uprise Digital • {data.clientName} • Keyword Intelligence • Page 3
                </Text>
            </View>
        </Page>

        {/* PAGE 4: BACK COVER */}
        <Page size="A4" style={styles.page}>
            <View style={styles.backCover}>
                <View style={styles.accentBar} />
                <Text style={styles.h2}>Looking Ahead</Text>
                <Text style={[styles.bodyText, { textAlign: 'center', maxWidth: 350 }]}>
                    Next month, our team will focus on expanding high-performing keyword clusters while
                    tightening bidding strategies on lower-efficiency segments to further maximize your ROAS.
                </Text>
                <View style={{ marginTop: 50, alignItems: 'center' }}>
                    <Text style={styles.labelSmall}>Account Managed By</Text>
                    <Text style={{ fontSize: 12, marginTop: 8, fontWeight: 'bold', color: '#1e293b' }}>
                        Uprise Digital Support Team
                    </Text>
                    <Text style={{ fontSize: 10, marginTop: 4, color: '#3b82f6' }}>ads@uprisedigital.com.au</Text>
                </View>
            </View>
        </Page>
    </Document>
);
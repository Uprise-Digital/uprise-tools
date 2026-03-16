// lib/report-utils.ts
const formatMetric = (value: number, decimalPlaces = 2, fallback = "-") => {
    if (value === null || value === undefined || isNaN(value) || !isFinite(value) || value === 0) {
        return fallback;
    }
    return value.toFixed(decimalPlaces);
};

const calcDelta = (curr: number, old: number | null) => {
    if (old === null || old === 0) return { val: "0.0", isPos: true };
    const diff = ((curr - old) / old) * 100;
    return { val: Math.abs(diff).toFixed(1), isPos: diff >= 0 };
};

export function transformAdsData(clientName: string, rawSummary: any[], rawKeywords: any[], lastMonth: any) {
    let totals = { cost: 0, clicks: 0, impressions: 0, conversions: 0 };

    const campaigns = rawSummary.map((row: any) => {
        const cost = Number(row.metrics.costMicros) / 1_000_000;
        const conv = Number(row.metrics.conversions);
        const clicks = Number(row.metrics.clicks);

        totals.cost += cost;
        totals.clicks += clicks;
        totals.impressions += Number(row.metrics.impressions);
        totals.conversions += conv;

        return {
            name: row.campaign.name,
            conversions: conv || 0,
            costPerConv: formatMetric(cost / conv),
            spend: cost.toFixed(2),
            clicks: clicks,
            ctr: formatMetric(Number(row.metrics.ctr) * 100),
            cpc: formatMetric(Number(row.metrics.averageCpc) / 1_000_000)
        };
    });

    const keywords = rawKeywords.map((row: any) => {
        const kwCost = Number(row.metrics.costMicros) / 1_000_000;
        const kwConv = Number(row.metrics.conversions);
        return {
            text: row.adGroupCriterion.keyword.text,
            matchType: row.adGroupCriterion.keyword.matchType,
            conversions: kwConv || 0,
            costPerConv: formatMetric(kwCost / kwConv),
            spend: kwCost.toFixed(2),
            clicks: Number(row.metrics.clicks),
            ctr: formatMetric(Number(row.metrics.ctr) * 100),
            cpc: formatMetric(Number(row.metrics.averageCpc) / 1_000_000)
        };
    });

    const current = {
        cost: totals.cost,
        conversions: totals.conversions,
        clicks: totals.clicks,
        ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
        cpc: totals.clicks > 0 ? (totals.cost / totals.clicks) : 0,
        cpa: totals.conversions > 0 ? (totals.cost / totals.conversions) : 0
    };

    const prev = lastMonth ? {
        cost: Number(lastMonth.costMicros) / 1_000_000,
        conversions: Number(lastMonth.conversions),
        clicks: Number(lastMonth.clicks),
        ctr: Number(lastMonth.impressions) > 0 ? (Number(lastMonth.clicks) / Number(lastMonth.impressions)) * 100 : 0,
        cpc: Number(lastMonth.clicks) > 0 ? (Number(lastMonth.costMicros) / 1_000_000 / Number(lastMonth.clicks)) : 0,
        cpa: Number(lastMonth.conversions) > 0 ? (Number(lastMonth.costMicros) / 1_000_000 / Number(lastMonth.conversions)) : 0
    } : null;

    return {
        clientName,
        metrics: {
            cost: totals.cost.toLocaleString(undefined, { minimumFractionDigits: 2 }),
            clicks: totals.clicks.toLocaleString(),
            ctr: formatMetric(current.ctr),
            conversions: totals.conversions,
            avgCpc: formatMetric(current.cpc),
            costPerConv: formatMetric(current.cpa),
            conversionsDelta: calcDelta(current.conversions, prev?.conversions || null),
            costDelta: calcDelta(current.cost, prev?.cost || null),
            clicksDelta: calcDelta(current.clicks, prev?.clicks || null),
            ctrDelta: calcDelta(current.ctr, prev?.ctr || null),
            cpcDelta: calcDelta(current.cpc, prev?.cpc || null),
            cpaDelta: calcDelta(current.cpa, prev?.cpa || null),
        },
        campaigns: campaigns.sort((a: any, b: any) => parseFloat(b.spend) - parseFloat(a.spend)).slice(0, 15),
        keywords: keywords,
    };
}
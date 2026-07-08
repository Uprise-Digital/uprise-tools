import { describe, expect, it } from "vitest";
import {
  auditConversionTrackingAction,
  getImpressionShareReportAction,
} from "@/actions/agency.actions";

describe("Diagnostics Actions", () => {
  it("should retrieve campaign impression share reports and classify constraints", async () => {
    const result = await getImpressionShareReportAction(1);

    if (!result.success) throw new Error(result.error);
    expect(result.data).toBeDefined();
    expect(result.data.length).toBe(2);

    const searchCampaign = result.data[0];
    expect(searchCampaign.campaignId).toBe("camp-1");
    expect(searchCampaign.isPMax).toBe(false);
    expect(searchCampaign.flag).toBe("budget-constrained");
    const pmaxCampaign = result.data[1];
    expect(pmaxCampaign.campaignId).toBe("camp-pmax");
    expect(pmaxCampaign.isPMax).toBe(true);
    expect(pmaxCampaign.flag).toBe("notAvailable");
  });

  it("should audit conversion tracking actions and generate warning flags", async () => {
    const result = await auditConversionTrackingAction(1);

    if (!result.success) throw new Error(result.error);
    expect(result.data).toBeDefined();
    expect(result.data.hasSpendInLast14Days).toBe(true);
    expect(result.data.actions.length).toBe(2);

    const action1 = result.data.actions[0];
    expect(action1.id).toBe("action-1");
    expect(action1.flags).toContain(
      "MANY_PER_CLICK on primary goal — check for inflation",
    );
    expect(action1.flags).toContain(
      "two primary actions in same category — possible double count",
    );

    const action2 = result.data.actions[1];
    expect(action2.id).toBe("action-2");
    expect(action2.flags).toContain(
      "two primary actions in same category — possible double count",
    );
    expect(action2.flags).toContain(
      "zero conversions in 14d despite active spend — check tag",
    );
  });
});

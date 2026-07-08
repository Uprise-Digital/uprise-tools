import { describe, it, expect, vi } from "vitest";
import {
  toggleTurboModeAction,
  getSuggestionsAction,
  updateSuggestionStatusAction,
  getAccountCampaignsAction,
} from "@/actions/negative-keywords.actions";

describe("Negative Keywords Management Actions", () => {
  it("should toggle turbo mode for negative keyword automation", async () => {
    const result = await toggleTurboModeAction(1, false);
    
    expect(result.success).toBe(true);
  });

  it("should retrieve pending negative keyword suggestions", async () => {
    const result = await getSuggestionsAction(1);
    
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data!.length).toBeGreaterThan(0);
    expect(result.data![0].keyword).toBe("free");
  });

  it("should approve or deny a negative keyword suggestion", async () => {
    const result = await updateSuggestionStatusAction(1, "approved");
    
    expect(result.success).toBe(true);
  });

  it("should get active campaigns for the ad account", async () => {
    const result = await getAccountCampaignsAction(1);
    
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
  });
});

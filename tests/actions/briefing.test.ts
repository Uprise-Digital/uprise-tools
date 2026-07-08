import { describe, expect, it } from "vitest";
import {
  generateBriefingAction,
  getBriefingDataAction,
  sendMorningBriefingAction,
} from "@/actions/briefing.actions";

describe("Daily Automated Email Briefing Actions", () => {
  it("should compile briefing data for connected client accounts", async () => {
    const result = await getBriefingDataAction();

    // Asserts that the compilation returns client metrics structure
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(Array.isArray(result.data?.successes)).toBe(true);
  });

  it("should generate the morning briefing report summary", async () => {
    const result = await generateBriefingAction();

    expect(result.success).toBe(true);
    expect(result.briefing).toBeDefined();
  });

  it("should trigger morning briefing dispatch via Resend API", async () => {
    const result = await sendMorningBriefingAction();

    expect(result.success).toBe(true);
  });
});

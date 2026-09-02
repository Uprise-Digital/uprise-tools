import { describe, expect, it } from "vitest";
import { getPreviousPeriodDateRange } from "@/lib/date-utils";

describe("Period-over-Period Date Utilities", () => {
  it("calculates exact 31-day previous period for August", () => {
    const range = getPreviousPeriodDateRange("2026-08-01", "2026-08-31");
    expect(range.durationDays).toBe(31);
    expect(range.prevStartDate).toBe("2026-07-01");
    expect(range.prevEndDate).toBe("2026-07-31");
  });

  it("calculates exact 7-day previous period", () => {
    const range = getPreviousPeriodDateRange("2026-08-08", "2026-08-14");
    expect(range.durationDays).toBe(7);
    expect(range.prevStartDate).toBe("2026-08-01");
    expect(range.prevEndDate).toBe("2026-08-07");
  });

  it("calculates exact 1-day previous period (yesterday)", () => {
    const range = getPreviousPeriodDateRange("2026-08-15", "2026-08-15");
    expect(range.durationDays).toBe(1);
    expect(range.prevStartDate).toBe("2026-08-14");
    expect(range.prevEndDate).toBe("2026-08-14");
  });

  it("calculates leap year / month crossover cleanly", () => {
    const range = getPreviousPeriodDateRange("2026-03-01", "2026-03-31");
    expect(range.durationDays).toBe(31);
    expect(range.prevStartDate).toBe("2026-01-29");
    expect(range.prevEndDate).toBe("2026-02-28");
  });
});

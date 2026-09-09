import { describe, expect, it } from "vitest";
import {
  type BaseAdAccount,
  type BaseMetaAdAccount,
  normalizeAccountName,
  unifyAccounts,
} from "@/lib/account-unification";

describe("normalizeAccountName", () => {
  it("normalizes names by stripping suffixes, whitespace, and casing", () => {
    expect(normalizeAccountName("Clean Energy Providers")).toBe(
      "cleanenergyproviders",
    );
    expect(normalizeAccountName("Clean Energy Providers Pty Ltd")).toBe(
      "cleanenergyproviders",
    );
    expect(normalizeAccountName("Clean Energy Providers - Google Ads")).toBe(
      "cleanenergyproviders",
    );
    expect(normalizeAccountName("Clean Energy Providers (Meta Ads)")).toBe(
      "cleanenergyproviders",
    );
    expect(normalizeAccountName("AAR Demo Ad Account")).toBe("aardemo");
  });

  it("handles empty or blank string gracefully", () => {
    expect(normalizeAccountName("")).toBe("");
  });
});

describe("unifyAccounts", () => {
  it("merges dual-platform accounts by normalized name", () => {
    const googleAccounts: BaseAdAccount[] = [
      {
        id: 101,
        googleAccountId: "5158080849",
        name: "Clean Energy Providers",
        currencyCode: "AUD",
        isActive: true,
        googleStatus: "ENABLED",
        industry: "ENERGY",
      },
      {
        id: 102,
        googleAccountId: "1112223333",
        name: "Google Only Client",
        currencyCode: "AUD",
        isActive: true,
        googleStatus: "ENABLED",
      },
    ];

    const metaAccounts: BaseMetaAdAccount[] = [
      {
        id: 201,
        metaAccountId: "1878682579665031",
        name: "Clean Energy Providers Pty Ltd",
        currencyCode: "AUD",
        timeZone: "Australia/Melbourne",
        isActive: true,
        accountStatus: 1,
      },
      {
        id: 202,
        metaAccountId: "999888777",
        name: "AAR Demo",
        currencyCode: "USD",
        timeZone: "Australia/Sydney",
        isActive: true,
        accountStatus: 1,
      },
    ];

    const unified = unifyAccounts(googleAccounts, metaAccounts);

    expect(unified).toHaveLength(3);

    // 1. Blended Account
    const blended = unified.find((u) => u.name === "Clean Energy Providers");
    expect(blended).toBeDefined();
    expect(blended?.platforms).toEqual(["google", "meta"]);
    expect(blended?.googleAccountId).toBe("5158080849");
    expect(blended?.metaAccountId).toBe("1878682579665031");
    expect(blended?.googleId).toBe(101);
    expect(blended?.metaId).toBe(201);

    // 2. Google-only Account
    const gOnly = unified.find((u) => u.name === "Google Only Client");
    expect(gOnly).toBeDefined();
    expect(gOnly?.platforms).toEqual(["google"]);
    expect(gOnly?.googleAccountId).toBe("1112223333");
    expect(gOnly?.metaAccountId).toBeUndefined();

    // 3. Meta-only Account
    const mOnly = unified.find((u) => u.name === "AAR Demo");
    expect(mOnly).toBeDefined();
    expect(mOnly?.platforms).toEqual(["meta"]);
    expect(mOnly?.metaAccountId).toBe("999888777");
    expect(mOnly?.googleAccountId).toBeUndefined();
  });
});

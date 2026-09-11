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

  it("merges accounts with plural and spacing variations like 'X Tech Renewables' and 'xTechs Renewables'", () => {
    const googleAccounts: BaseAdAccount[] = [
      {
        id: 724,
        googleAccountId: "7240382007",
        name: "X Tech Renewables",
        currencyCode: "AUD",
        isActive: true,
        googleStatus: "ENABLED",
        industry: "ENERGY",
      },
    ];

    const metaAccounts: BaseMetaAdAccount[] = [
      {
        id: 988,
        metaAccountId: "act_988231820415384",
        name: "xTechs Renewables",
        currencyCode: "AUD",
        timeZone: "Australia/Melbourne",
        isActive: true,
        accountStatus: 1,
      },
    ];

    const unified = unifyAccounts(googleAccounts, metaAccounts);

    expect(unified).toHaveLength(1);
    expect(unified[0].platforms).toEqual(["google", "meta"]);
    expect(unified[0].googleAccountId).toBe("7240382007");
    expect(unified[0].metaAccountId).toBe("act_988231820415384");
    expect(unified[0].industry).toBe("ENERGY");
  });

  it("safeguards against false positives for numbered franchises or stores", () => {
    const googleAccounts: BaseAdAccount[] = [
      {
        id: 1,
        googleAccountId: "111",
        name: "Subway Store 101",
        currencyCode: "AUD",
        isActive: true,
        googleStatus: "ENABLED",
      },
    ];

    const metaAccounts: BaseMetaAdAccount[] = [
      {
        id: 2,
        metaAccountId: "222",
        name: "Subway Store 102",
        currencyCode: "AUD",
        timeZone: "Australia/Sydney",
        isActive: true,
        accountStatus: 1,
      },
    ];

    const unified = unifyAccounts(googleAccounts, metaAccounts);

    // They must NOT merge because store numbers 101 vs 102 differ!
    expect(unified).toHaveLength(2);
    expect(
      unified.find((u) => u.name === "Subway Store 101")?.platforms,
    ).toEqual(["google"]);
    expect(
      unified.find((u) => u.name === "Subway Store 102")?.platforms,
    ).toEqual(["meta"]);
  });

  it("safeguards against false positives for short distinct brand names", () => {
    const googleAccounts: BaseAdAccount[] = [
      {
        id: 1,
        googleAccountId: "111",
        name: "Sprint",
        currencyCode: "USD",
        isActive: true,
        googleStatus: "ENABLED",
      },
    ];

    const metaAccounts: BaseMetaAdAccount[] = [
      {
        id: 2,
        metaAccountId: "222",
        name: "Spring",
        currencyCode: "USD",
        timeZone: "America/New_York",
        isActive: true,
        accountStatus: 1,
      },
    ];

    const unified = unifyAccounts(googleAccounts, metaAccounts);

    // Must NOT merge
    expect(unified).toHaveLength(2);
    expect(unified[0].platforms).toEqual(["google"]);
    expect(unified[1].platforms).toEqual(["meta"]);
  });

  it("deterministically merges accounts with completely different names if linked to the same clientOnboardingId", () => {
    const googleAccounts: BaseAdAccount[] = [
      {
        id: 186,
        googleAccountId: "1862942268",
        name: "Smooth Concrete",
        currencyCode: "AUD",
        isActive: true,
        googleStatus: "ENABLED",
        clientOnboardingId: 42,
        industry: "CONSTRUCTION",
      },
    ];

    const metaAccounts: BaseMetaAdAccount[] = [
      {
        id: 986,
        metaAccountId: "act_9861781273932652",
        name: "Smooth Ads",
        currencyCode: "AUD",
        timeZone: "Australia/Melbourne",
        isActive: true,
        accountStatus: 1,
        clientOnboardingId: 42,
      },
    ];

    const unified = unifyAccounts(googleAccounts, metaAccounts);

    // They MUST merge because clientOnboardingId matches (42), despite names differing!
    expect(unified).toHaveLength(1);
    expect(unified[0].platforms).toEqual(["google", "meta"]);
    expect(unified[0].googleAccountId).toBe("1862942268");
    expect(unified[0].metaAccountId).toBe("act_9861781273932652");
    expect(unified[0].clientOnboardingId).toBe(42);
  });
});

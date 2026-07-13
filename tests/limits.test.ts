import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { adAccounts, landingPageAudits } from "../src/db/schema";
import { checkDailyAuditLimit } from "../src/lib/limits";

// Disable global db mock for this test
vi.unmock("@/db");

const db = (await import("../src/db/index")).db;

describe("Daily Audit Limits Tests", () => {
  const TEST_ORG = "org-limits-test";

  beforeAll(async () => {
    // Cleanup
    await db
      .delete(landingPageAudits)
      .where(eq(landingPageAudits.organizationId, TEST_ORG));
    await db.delete(adAccounts).where(eq(adAccounts.organizationId, TEST_ORG));
  });

  afterAll(async () => {
    // Cleanup
    await db
      .delete(landingPageAudits)
      .where(eq(landingPageAudits.organizationId, TEST_ORG));
    await db.delete(adAccounts).where(eq(adAccounts.organizationId, TEST_ORG));
  });

  test("should enforce the daily limit correctly", async () => {
    // Set a small limit for testing
    process.env.DAILY_AUDIT_LIMIT = "2";

    // 1. Create a dummy ad account first to avoid foreign key violation
    const [testAccount] = await db
      .insert(adAccounts)
      .values({
        organizationId: TEST_ORG,
        googleAccountId: "limits-test-google-id",
        name: "Limits Test Ad Account",
        isActive: true,
      })
      .returning({ id: adAccounts.id });

    const adAccountId = testAccount.id;

    const check1 = await checkDailyAuditLimit(TEST_ORG);
    expect(check1.allowed).toBe(true);
    expect(check1.limit).toBe(2);
    expect(check1.current).toBe(0);

    // Insert first audit
    await db.insert(landingPageAudits).values({
      organizationId: TEST_ORG,
      adAccountId: adAccountId,
      url: "https://test.com",
      searchTerm: "plumber",
      score: 80,
      aiAnalysis: {},
    });

    const check2 = await checkDailyAuditLimit(TEST_ORG);
    expect(check2.allowed).toBe(true);
    expect(check2.current).toBe(1);

    // Insert second audit
    await db.insert(landingPageAudits).values({
      organizationId: TEST_ORG,
      adAccountId: adAccountId,
      url: "https://test.com/2",
      searchTerm: "plumber",
      score: 85,
      aiAnalysis: {},
    });

    const check3 = await checkDailyAuditLimit(TEST_ORG);
    expect(check3.allowed).toBe(false); // Limit hit! (2/2)
    expect(check3.current).toBe(2);

    // Clean up ad account
    await db.delete(adAccounts).where(eq(adAccounts.id, adAccountId));
  }, 30000);
});

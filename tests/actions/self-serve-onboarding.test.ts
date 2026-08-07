import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock better-auth getSession
vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

import { createOrganizationAction } from "@/actions/onboarding.actions";
import { auth } from "@/lib/auth";

describe("Self-Serve Onboarding Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should fail organization creation if user is unauthorized", async () => {
    (auth.api.getSession as any).mockResolvedValue(null);

    await expect(
      createOrganizationAction({
        name: "Test Agency",
        description: "A test marketing agency",
        autoJoinDomain: true,
        defaultTimezone: "America/New_York",
        defaultCurrency: "USD",
      }),
    ).rejects.toThrow("Unauthorized");
  });

  it("should create organization with timezone and currency metadata when authorized", async () => {
    (auth.api.getSession as any).mockResolvedValue({
      user: {
        id: "user-test-123",
        name: "Agency Admin",
        email: "admin@testagency.com",
      },
    });

    const res = await createOrganizationAction({
      name: "Apex Growth Agency",
      description: "Performance PPC Experts",
      autoJoinDomain: true,
      defaultTimezone: "America/New_York",
      defaultCurrency: "USD",
    });

    expect(res.success).toBe(true);
    expect(res.organizationId).toBeDefined();
    expect(typeof res.organizationId).toBe("string");
  });
});

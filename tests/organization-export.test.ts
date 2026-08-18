import { describe, expect, it, vi } from "vitest";

// Mock DB for organization export tests
vi.mock("@/db", () => {
  return {
    db: {
      query: {
        member: {
          findFirst: vi.fn().mockResolvedValue({
            id: "mem-export-1",
            userId: "user-owner-1",
            organizationId: "org-export-101",
            role: "owner",
          }),
        },
        organization: {
          findFirst: vi.fn().mockResolvedValue({
            id: "org-export-101",
            name: "Vanguard Digital",
            slug: "vanguard-digital",
            logoUrl: "https://r2.cdn.com/vanguard-logo.png",
            emailSignature: "Vanguard Team",
            websiteUrl: "https://vanguard.com",
            supportEmail: "support@vanguard.com",
            createdAt: new Date(),
          }),
        },
        organizationOnboardingSettings: {
          findFirst: vi.fn().mockResolvedValue({
            id: "settings-101",
            ghlLocationId: "loc-123",
            ghlCompanyId: "comp-456",
            notionParentPageId: "notion-789",
            ghlApiKey: "encrypted-ghl-secret",
            notionApiKey: "encrypted-notion-secret",
          }),
        },
      },
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([
              {
                id: "mem-1",
                userId: "user-owner-1",
                userName: "Alex Vance",
                userEmail: "alex@vanguard.com",
                role: "owner",
              },
            ]),
          }),
          where: vi.fn().mockImplementation((condition) => {
            // Return appropriate mock arrays based on context
            return Promise.resolve([
              {
                id: "client-1",
                clientName: "Acme Corp",
                contactEmail: "contact@acme.com",
              },
            ]);
          }),
        }),
      }),
    },
  };
});

// Mock Auth Session
vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn().mockResolvedValue({
        user: { id: "user-owner-1", email: "alex@vanguard.com" },
        session: { activeOrganizationId: "org-export-101" },
      }),
    },
  },
}));

import { exportOrganizationDataAction } from "@/actions/organization-export.actions";

describe("Data Portability & Tenant Export (GDPR Art. 20)", () => {
  it("should compile a valid JSON export containing metadata and sanitized tenant records", async () => {
    const result = await exportOrganizationDataAction();

    expect(result.success).toBe(true);
    expect(result.filename?.toLowerCase()).toContain("vanguard_digital");
    expect(result.filename).toContain(".json");

    expect(result.data).toBeDefined();
    const payload = JSON.parse(result.data!);

    expect(payload.$schema).toBe(
      "https://schema.uprise.tools/v1/tenant-export.json",
    );
    expect(payload.metadata.organizationName).toBe("Vanguard Digital");
    expect(payload.organization.name).toBe("Vanguard Digital");
    expect(payload.onboardingAndIntegrations.ghlLocationId).toBe("loc-123");
    // Ensure raw secret key is NOT leaked in raw plain text
    expect(payload.onboardingAndIntegrations.ghlApiKey).toBeUndefined();
    expect(payload.onboardingAndIntegrations.hasGhlKeyConfigured).toBe(true);
  });
});

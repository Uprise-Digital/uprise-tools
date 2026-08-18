import { describe, expect, it, vi } from "vitest";

// Mock DB for offboarding tests
vi.mock("@/db", () => {
  return {
    db: {
      query: {
        member: {
          findFirst: vi.fn().mockImplementation(({ where }: any) => {
            return Promise.resolve({
              id: "mem-1",
              userId: "user-owner",
              organizationId: "org-target-123",
              role: "owner",
            });
          }),
        },
        organization: {
          findFirst: vi.fn().mockResolvedValue({
            id: "org-target-123",
            name: "Apex Marketing",
            logoUrl: "https://r2.cdn.com/apex-logo.png",
          }),
        },
      },
    },
  };
});

// Mock Auth Session
vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn().mockResolvedValue({
        user: { id: "user-owner", email: "owner@apex.com" },
        session: { activeOrganizationId: "org-target-123" },
      }),
    },
  },
}));

// Mock DB Helper
vi.mock("@/db/db-helper", () => ({
  withBypassTenantDb: vi.fn().mockImplementation(async (callback) => {
    const fakeTx = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: 101 }]),
        }),
      }),
      delete: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(true),
      }),
    };
    return callback(fakeTx);
  }),
}));

// Mock Storage
vi.mock("@/lib/storage", () => ({
  deleteFileFromR2: vi.fn().mockResolvedValue(true),
}));

import { deleteOrganizationAction } from "@/actions/organization-offboarding.actions";

describe("Organization Offboarding & GDPR Data Erasure", () => {
  it("should fail if confirmation string is invalid", async () => {
    const result = await deleteOrganizationAction("DELETE MY ORG");
    expect(result.success).toBe(false);
    expect(result.error).toContain("Confirmation failed");
  });

  it("should successfully trigger cascade deletion when requested by Owner with valid confirmation", async () => {
    const result = await deleteOrganizationAction("DELETE MY ORGANIZATION");
    expect(result.success).toBe(true);
  });
});

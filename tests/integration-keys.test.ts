import { describe, expect, it, vi } from "vitest";

// Mock DB module for unit testing key resolution
vi.mock("@/db", () => {
  return {
    db: {
      query: {
        organizationOnboardingSettings: {
          findFirst: vi.fn(),
        },
      },
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            {
              id: 1,
              organizationId: "org-test-123",
              notionApiKey: "mock-encrypted-notion-key",
              ghlApiKey: "mock-encrypted-ghl-key",
              googleDriveRefreshToken: "mock-encrypted-drive-token",
            },
          ]),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(true),
        }),
      }),
    },
  };
});

import { decryptToken, encryptToken } from "@/lib/crypto";
import { getGhlCredentials } from "@/service/gohighlevel-service";

describe("Strict DB-Level Integration Keys Migration", () => {
  it("should encrypt and decrypt tokens accurately using AES-256-GCM", () => {
    const rawKey = "pit-987654321-test-ghl-secret-key";
    const encrypted = encryptToken(rawKey);

    expect(encrypted).not.toBe(rawKey);
    expect(encrypted).toContain(":"); // IV and auth tag separator

    const decrypted = decryptToken(encrypted);
    expect(decrypted).toBe(rawKey);
  });

  it("should throw a clean error when GoHighLevel is unconfigured for an organization", async () => {
    await expect(getGhlCredentials("org-non-existent-999")).rejects.toThrow(
      "GoHighLevel is not configured for this organization",
    );
  });

  it("should resolve explicit API key when supplied directly", async () => {
    const explicitKey = "pit-explicit-test-key";
    const creds = await getGhlCredentials(undefined, explicitKey, "loc-123");

    expect(creds.apiKey).toBe(explicitKey);
    expect(creds.locationId).toBe("loc-123");
  });
});

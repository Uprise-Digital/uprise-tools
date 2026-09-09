import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  connectMetaPermanentTokenAction,
  disconnectMetaAdsAction,
  getMetaAdAccountsAction,
  getMetaConnectionAction,
  syncMetaAdAccountsAction,
} from "@/actions/meta-settings.actions";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { encryptToken } from "@/lib/crypto";

describe("Meta Settings Actions - Permanent System User Token", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();

    process.env.ENCRYPTION_KEY =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: {
        id: "test-user-id",
        name: "Test User",
        email: "test@uprise.digital",
      },
      session: {
        activeOrganizationId: "org-test-uprise",
      },
    } as any);
  });

  describe("getMetaConnectionAction", () => {
    it("should return connection with permanent token details", async () => {
      const res = await getMetaConnectionAction();

      expect(res.success).toBe(true);
      expect(res.connection).toBeDefined();
      expect(res.connection?.isPermanent).toBe(true);
      expect(res.connection?.businessId).toBe("2448649278688629");
      expect(res.connection?.accessLevel).toBe("system_user");
    });

    it("should return unauthorized if session has no active organization", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValueOnce(null);

      const res = await getMetaConnectionAction();

      expect(res.success).toBe(false);
      expect(res.error).toBe("Unauthorized");
    });
  });

  describe("connectMetaPermanentTokenAction", () => {
    it("should reject when access token is empty", async () => {
      const res = await connectMetaPermanentTokenAction({
        accessToken: "   ",
        businessId: "2448649278688629",
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("Meta Access Token is required");
    });

    it("should fail when Meta API returns an error for invalid token", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue({
          error: {
            message: "Invalid OAuth access token.",
            type: "OAuthException",
            code: 190,
          },
        }),
      });

      const res = await connectMetaPermanentTokenAction({
        accessToken: "EAA_invalid_token",
        businessId: "2448649278688629",
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("Meta API Verification Error");
    });

    it("should successfully verify, encrypt, and store a permanent System User token", async () => {
      // 1. /me call
      (global.fetch as any).mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue({
          id: "sys_user_999",
          name: "Uprise System User Admin",
        }),
      });

      // 2. /debug_token call (expires_at: 0 indicates permanent)
      (global.fetch as any).mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue({
          data: {
            app_id: "1388841019333890",
            type: "SYSTEM_USER",
            application: "Uprise Tools",
            expires_at: 0,
            is_valid: true,
            scopes: ["ads_read", "read_insights", "business_management"],
          },
        }),
      });

      // 3. /client_ad_accounts call (discovers 1 client account)
      (global.fetch as any).mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue({
          data: [
            {
              id: "act_9876543210",
              account_id: "9876543210",
              name: "Client Brand Australia",
              currency: "AUD",
              timezone_name: "Australia/Melbourne",
              account_status: 1,
            },
          ],
        }),
      });

      // 4. /me/adaccounts call
      (global.fetch as any).mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue({
          data: [],
        }),
      });

      const res = await connectMetaPermanentTokenAction({
        accessToken: "EAAB_test_valid_system_user_token_123",
        businessId: "2448649278688629",
      });

      expect(res.success).toBe(true);
      expect(res.message).toBe("Meta System User connected successfully.");
      expect(res.syncedAccountsCount).toBe(1);

      // Verify db update/insert was called
      expect(db.update).toHaveBeenCalled();
    });
  });

  describe("syncMetaAdAccountsAction", () => {
    it("should decrypt token and sync ad accounts from Graph API", async () => {
      // Mock db connection to return encrypted token
      const rawToken = "EAAB_real_permanent_token";
      const encrypted = encryptToken(rawToken);

      (db.query.metaAdsConnections.findFirst as any).mockResolvedValueOnce({
        id: 1,
        organizationId: "org-test-uprise",
        businessId: "2448649278688629",
        accessToken: encrypted,
      });

      // Mock /client_ad_accounts
      (global.fetch as any).mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue({
          data: [
            {
              id: "act_111222333",
              account_id: "111222333",
              name: "Sync Test Client",
              currency: "USD",
              timezone_name: "America/New_York",
              account_status: 1,
            },
          ],
        }),
      });

      // Mock /me/adaccounts
      (global.fetch as any).mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue({
          data: [],
        }),
      });

      const res = await syncMetaAdAccountsAction();

      expect(res.success).toBe(true);
      expect(res.syncedAccountsCount).toBe(1);
    });

    it("should return error if no Meta connection found", async () => {
      (db.query.metaAdsConnections.findFirst as any).mockResolvedValueOnce(
        null,
      );

      const res = await syncMetaAdAccountsAction();

      expect(res.success).toBe(false);
      expect(res.error).toBe("No Meta connection found.");
    });
  });

  describe("getMetaAdAccountsAction", () => {
    it("should return list of synced ad accounts", async () => {
      const res = await getMetaAdAccountsAction();

      expect(res.success).toBe(true);
      expect(Array.isArray(res.accounts)).toBe(true);
      expect(res.accounts?.length).toBeGreaterThan(0);
      expect(res.accounts?.[0].metaAccountId).toBe("1234567890");
    });
  });

  describe("disconnectMetaAdsAction", () => {
    it("should delete accounts and connection records", async () => {
      const res = await disconnectMetaAdsAction();

      expect(res.success).toBe(true);
      expect(db.delete).toHaveBeenCalled();
    });
  });
});

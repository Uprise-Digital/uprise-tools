import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as handleGhlSearchProxy } from "@/app/api/gohighlevel/search/route";
import { POST as handleSubmitAdsId } from "@/app/api/onboard/submit-ads-id/route";
import { POST as handleGhlWebhook } from "@/app/api/webhooks/gohighlevel/route";
import { db } from "@/db";
import { auth } from "@/lib/auth";

// Mock onboarding automation action to prevent background timeout during tests
vi.mock("@/actions/client-onboarding.actions", () => ({
  triggerOnboardingAutomation: vi.fn().mockResolvedValue(undefined),
}));

describe("Client Onboarding API Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "webhook-test-secret";
    process.env.GOOGLE_ADS_MANAGER_ID = "8746252766";

    // Mock session auth
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: {
        id: "test-user-id",
        name: "Test Admin",
        email: "admin@uprise.com.au",
      },
      session: { activeOrganizationId: "org-test-123" },
    } as any);

    // Mock first organization find for fallback
    (db.query as any).organization = {
      findFirst: vi
        .fn()
        .mockResolvedValue({ id: "org-test-123", name: "Uprise Digital" }),
    };

    // Mock clientOnboardings query find
    (db.query as any).clientOnboardings = {
      findFirst: vi.fn().mockResolvedValue({
        id: 101,
        clientName: "KGN Homes",
        primaryContactName: "Sultan",
        contactEmail: "sultan@kgnhomes.com.au",
        googleAdsAccess: true,
        metaAdsAccess: true,
      }),
    };
  });

  describe("GoHighLevel Webhook POST /api/webhooks/gohighlevel", () => {
    it("should return 401 Unauthorized if secret is missing or incorrect", async () => {
      const req = new Request(
        "http://localhost/api/webhooks/gohighlevel?secret=wrong",
        {
          method: "POST",
          body: JSON.stringify({}),
        },
      );

      const response = await handleGhlWebhook(req as any);
      expect(response.status).toBe(401);

      const body = await response.json();
      expect(body.error).toContain("Unauthorized");
    });

    it("should return 400 if email is missing in the payload", async () => {
      const req = new Request(
        "http://localhost/api/webhooks/gohighlevel?secret=webhook-test-secret",
        {
          method: "POST",
          body: JSON.stringify({
            contact: { firstName: "Sultan", companyName: "KGN Homes" },
          }),
        },
      );

      const response = await handleGhlWebhook(req as any);
      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.error).toContain("Missing contact email");
    });

    it("should successfully parse and create a client draft onboarding record", async () => {
      // Mock db.query findFirst to resolve to null (no existing client)
      vi.mocked(
        (db.query as any).clientOnboardings.findFirst,
      ).mockResolvedValueOnce(null);

      // Mock db.insert chain
      vi.mocked(db.insert).mockReturnValueOnce({
        values: vi.fn().mockReturnValueOnce({
          returning: vi.fn().mockResolvedValueOnce([{ id: 101 }]),
        }),
      } as any);

      // Simulate a webhook trigger from GHL
      const req = new Request(
        "http://localhost/api/webhooks/gohighlevel?secret=webhook-test-secret",
        {
          method: "POST",
          body: JSON.stringify({
            contact: {
              id: "ghl_c_1",
              firstName: "Sultan",
              email: "sultan@kgnhomes.com.au",
              companyName: "KGN Homes",
              tags: ["Google Ads", "Meta Ads"],
            },
            opportunity: {
              id: "ghl_opp_1",
            },
          }),
        },
      );

      const response = await handleGhlWebhook(req as any);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.onboardingId).toBe(101);
      expect(db.insert).toHaveBeenCalled();
    });
  });

  describe("GoHighLevel Search Proxy GET /api/gohighlevel/search", () => {
    it("should return 401 if user session is unauthorized", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValueOnce(null);

      const req = new Request(
        "http://localhost/api/gohighlevel/search?query=sultan",
        {
          method: "GET",
        },
      );

      const response = await handleGhlSearchProxy(req as any);
      expect(response.status).toBe(401);
    });

    it("should return empty results if search query is too short", async () => {
      const req = new Request(
        "http://localhost/api/gohighlevel/search?query=s",
        {
          method: "GET",
        },
      );

      const response = await handleGhlSearchProxy(req as any);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.contacts).toEqual([]);
    });
  });

  describe("Google Ads ID Submission POST /api/onboard/submit-ads-id", () => {
    it("should return 400 if Ads Account ID is invalid or formatted incorrectly", async () => {
      const req = new Request("http://localhost/api/onboard/submit-ads-id", {
        method: "POST",
        body: JSON.stringify({ googleAccountId: "invalid" }),
      });

      const response = await handleSubmitAdsId(req as any);
      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.error).toContain("Invalid Google Ads");
    });

    it("should successfully update googleAdsStatus in DB and mock link submission", async () => {
      const req = new Request("http://localhost/api/onboard/submit-ads-id", {
        method: "POST",
        body: JSON.stringify({
          googleAccountId: "123-456-7890",
          onboardingId: "101",
          token: "mock-token",
        }),
      });

      const response = await handleSubmitAdsId(req as any);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.success).toBe(true);
      expect(db.update).toHaveBeenCalled();
    });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  associateAdAccountAction,
  createClientOnboardingAction,
  deleteClientOnboardingAction,
  updateClientOnboardingAction,
} from "@/actions/client-onboarding.actions";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { compileOnboardingEmail } from "@/lib/onboarding-email";

describe("Client Onboarding Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RESEND_API_KEY = "re_test_key_123";

    // Setup default successful session mock
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: {
        id: "test-user-id",
        name: "Test Admin",
        email: "admin@uprisedigital.com.au",
      },
      session: {
        activeOrganizationId: "org-test-uprise",
      },
    } as any);
  });

  describe("createClientOnboardingAction", () => {
    it("should successfully insert a client onboarding draft and return the new ID", async () => {
      // Mock db.insert to return the inserted ID
      vi.mocked(db.insert).mockReturnValueOnce({
        values: vi.fn().mockReturnValueOnce({
          returning: vi.fn().mockResolvedValueOnce([{ id: 101 }]),
        }),
      } as any);

      const result = await createClientOnboardingAction({
        clientName: "KGN Homes",
        primaryContactName: "Sultan",
        contactEmail: "sultan@kgnhomes.com.au",
        googleAdsAccess: true,
        metaAdsAccess: true,
      });

      expect(result.success).toBe(true);
      expect(result.onboardingId).toBe(101);
      expect(db.insert).toHaveBeenCalled();
    });

    it("should fail if unauthorized", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValueOnce(null);

      const result = await createClientOnboardingAction({
        clientName: "KGN Homes",
        primaryContactName: "Sultan",
        contactEmail: "sultan@kgnhomes.com.au",
        googleAdsAccess: true,
        metaAdsAccess: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unauthorized");
    });
  });

  describe("updateClientOnboardingAction", () => {
    it("should successfully update client details", async () => {
      const result = await updateClientOnboardingAction(101, {
        driveFolderLink: "https://drive.google.com/mock-folder",
      });

      expect(result.success).toBe(true);
      expect(db.update).toHaveBeenCalled();
    });
  });

  describe("deleteClientOnboardingAction", () => {
    it("should successfully delete the client record", async () => {
      const result = await deleteClientOnboardingAction(101);

      expect(result.success).toBe(true);
      expect(db.delete).toHaveBeenCalled();
    });
  });

  describe("associateAdAccountAction", () => {
    it("should update the adAccount mapping to associate the client onboarding ID", async () => {
      const result = await associateAdAccountAction(101, 42);

      expect(result.success).toBe(true);
      expect(db.update).toHaveBeenCalled();
    });
  });

  describe("compileOnboardingEmail", () => {
    it("should dynamically build instructions for Google Ads and Meta Ads when selected", () => {
      const result = compileOnboardingEmail({
        primaryContactName: "Sultan",
        clientName: "KGN Homes",
        driveFolderLink: "https://drive.mock/folder",
        notionDashboardLink: "https://notion.mock/dashboard",
        signalGroupLink: "https://signal.mock/chat",
        googleAdsAccess: true,
        metaAdsAccess: true,
      });

      expect(result.text).toContain("google-ads-access");
      expect(result.text).toContain("meta-ads-access");
      expect(result.html).toContain("Google Ads Account Access Instructions");
      expect(result.html).toContain("Meta Ads Account Access Instructions");
    });

    it("should omit Meta Ads instructions when metaAdsAccess is false", () => {
      const result = compileOnboardingEmail({
        primaryContactName: "Sultan",
        clientName: "KGN Homes",
        driveFolderLink: "https://drive.mock/folder",
        notionDashboardLink: "https://notion.mock/dashboard",
        signalGroupLink: "https://signal.mock/chat",
        googleAdsAccess: true,
        metaAdsAccess: false,
      });

      expect(result.text).toContain("google-ads-access");
      expect(result.text).not.toContain("meta-ads-access");
      expect(result.html).toContain("Google Ads Account Access Instructions");
      expect(result.html).not.toContain("Meta Ads Account Access Instructions");
    });

    it("should omit Google Ads instructions when googleAdsAccess is false", () => {
      const result = compileOnboardingEmail({
        primaryContactName: "Sultan",
        clientName: "KGN Homes",
        driveFolderLink: "https://drive.mock/folder",
        notionDashboardLink: "https://notion.mock/dashboard",
        signalGroupLink: "https://signal.mock/chat",
        googleAdsAccess: false,
        metaAdsAccess: true,
      });

      expect(result.text).not.toContain("google-ads-access");
      expect(result.text).toContain("meta-ads-access");
      expect(result.html).not.toContain(
        "Google Ads Account Access Instructions",
      );
      expect(result.html).toContain("Meta Ads Account Access Instructions");
    });
  });
});

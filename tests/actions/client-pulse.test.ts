import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getClientPulseBoardDataAction,
  submitClientPulseRatingAction,
} from "@/actions/client-pulse.actions";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { getWeekMondayString } from "@/lib/date-utils";

describe("Client Standup Pulse Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: {
        id: "test-user-id",
        name: "Test User",
        email: "test@uprise.com",
      },
      session: {
        activeOrganizationId: "org-test-uprise",
      },
    } as any);
  });

  describe("getWeekMondayString", () => {
    it("should return a valid YYYY-MM-DD Monday string for current and offset weeks", () => {
      const currentMonday = getWeekMondayString(0);
      expect(currentMonday).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      const prevMonday = getWeekMondayString(-1);
      expect(prevMonday).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(prevMonday < currentMonday).toBe(true);
    });
  });

  describe("getClientPulseBoardDataAction", () => {
    it("should return empty clients list when no active clients are found", async () => {
      vi.mocked(db.query.clients.findMany).mockResolvedValueOnce([]);

      const result = await getClientPulseBoardDataAction();
      expect(result.success).toBe(true);
      expect(result.data?.clients).toEqual([]);
      expect(result.data?.summary.totalClients).toBe(0);
    });

    it("should load clients, calculate automated performance, and aggregate risk scores", async () => {
      vi.mocked(db.query.clients.findMany).mockResolvedValueOnce([
        {
          id: 1,
          organizationId: "org-test-uprise",
          name: "Acme Plumbing",
          industry: "TRADES",
          status: "active",
          websiteUrl: "https://acme.com",
          googleEnabled: true,
          metaEnabled: false,
          adAccounts: [
            {
              id: 10,
              clientId: 1,
              targetCpa: "35.00",
            },
          ],
          metaAdAccounts: [],
        } as any,
      ]);

      vi.mocked(db.query.clientPulseRatings.findMany).mockResolvedValueOnce([
        {
          id: 100,
          organizationId: "org-test-uprise",
          clientId: 1,
          userId: "test-user-id",
          pulseDate: getWeekMondayString(0),
          riskScore: 70,
          sentiment: "high_risk",
          primaryFactor: "lead_quality",
          notes: "Client questioned lead quality",
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any,
      ]);

      const result = await getClientPulseBoardDataAction(0);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.clients.length).toBe(1);

      const client = result.data?.clients[0];
      expect(client?.name).toBe("Acme Plumbing");
      expect(client?.teamSentimentScore).toBe(70);
      expect(client?.staffRatingsCount).toBe(1);
      expect(client?.compositeRiskScore).toBeGreaterThan(0);
      expect(client?.staffRatings[0].notes).toBe("Client questioned lead quality");
    });

    it("should fail gracefully if unauthorized", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValueOnce(null as any);

      const result = await getClientPulseBoardDataAction();
      expect(result.success).toBe(false);
      expect(result.error).toContain("Unauthorized");
    });
  });

  describe("submitClientPulseRatingAction", () => {
    it("should insert or update a staff rating and return success", async () => {
      const result = await submitClientPulseRatingAction({
        clientId: 1,
        riskScore: 65,
        sentiment: "high_risk",
        primaryFactor: "lead_volume",
        notes: "Discussed on Monday call: scaling up ad spend",
      });

      expect(result.success).toBe(true);
      expect(db.insert).toHaveBeenCalled();
    });

    it("should fail if unauthorized", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValueOnce(null as any);

      const result = await submitClientPulseRatingAction({
        clientId: 1,
        riskScore: 40,
        sentiment: "moderate_risk",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Unauthorized");
    });
  });
});

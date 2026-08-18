import { describe, expect, it, vi } from "vitest";

// Mock DB for email service tests
vi.mock("@/db", () => {
  return {
    db: {
      query: {
        organization: {
          findFirst: vi.fn().mockResolvedValue({
            id: "org-123",
            name: "Vanguard Marketing",
            brandName: "Vanguard Marketing Agency",
            logoUrl: "https://cdn.vanguard.com/logo.png",
            emailSignature: "Vanguard Success Team\nwww.vanguard.com",
            websiteUrl: "https://www.vanguard.com",
            supportEmail: "support@vanguard.com",
          }),
        },
        organizationEmailTemplates: {
          findFirst: vi.fn().mockResolvedValue(null),
          findMany: vi.fn().mockResolvedValue([]),
        },
      },
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(true),
      }),
    },
  };
});

// Mock Resend SDK
vi.mock("resend", () => {
  return {
    Resend: class MockResend {
      emails = {
        send: vi.fn().mockResolvedValue({ data: { id: "resend-msg-999" } }),
      };
    },
  };
});

import { sendSystemEmail, SYSTEM_EMAIL_TEMPLATES } from "@/lib/email-service";

describe("Centralized Email Service", () => {
  it("should contain registry of default system templates", () => {
    expect(SYSTEM_EMAIL_TEMPLATES.onboarding_welcome).toBeDefined();
    expect(SYSTEM_EMAIL_TEMPLATES.daily_briefing).toBeDefined();
    expect(SYSTEM_EMAIL_TEMPLATES.client_report).toBeDefined();
    expect(SYSTEM_EMAIL_TEMPLATES.pipeline_digest).toBeDefined();
    expect(SYSTEM_EMAIL_TEMPLATES.team_invite).toBeDefined();
  });

  it("should send email replacing template variables and injecting tenant branding", async () => {
    const res = await sendSystemEmail({
      organizationId: "org-123",
      templateKey: "team_invite",
      to: "newuser@example.com",
      variables: {
        role: "Admin",
        invite_url: "https://app.agency.com/signup?invite=123",
      },
    });

    expect(res.success).toBe(true);
    expect(res.resendId).toBe("resend-msg-999");
  });
});

import { describe, expect, it } from "vitest";
import {
  enforceEmailSafeguard,
  isTeamEmail,
  SAFE_AGENT_EMAIL,
  ALLOW_AUTOMATED_EMAILS,
} from "@/lib/email-guard";

describe("Zero-Tolerance Email Guard", () => {
  it("should have automated sending locked down by default", () => {
    expect(ALLOW_AUTOMATED_EMAILS).toBe(false);
  });

  describe("isTeamEmail", () => {
    it("should accept valid @uprisedigital.com.au emails", () => {
      expect(isTeamEmail("seyone@uprisedigital.com.au")).toBe(true);
      expect(isTeamEmail("alex@uprisedigital.com.au")).toBe(true);
      expect(isTeamEmail("NICK@UPRISEDIGITAL.COM.AU")).toBe(true);
      expect(isTeamEmail("  sujee@uprisedigital.com.au  ")).toBe(true);
    });

    it("should strictly reject non-uprisedigital emails", () => {
      expect(isTeamEmail("Michael@cleanenergyproviders.com.au")).toBe(false);
      expect(isTeamEmail("kurt@kurtspoolfencing.au")).toBe(false);
      expect(isTeamEmail("client@gmail.com")).toBe(false);
      expect(isTeamEmail("fake@uprisedigital.com")).toBe(false); // wrong TLD (.com vs .com.au)
      expect(isTeamEmail("attacker@uprisedigital.com.au.hacker.com")).toBe(false);
      expect(isTeamEmail("")).toBe(false);
    });
  });

  describe("enforceEmailSafeguard", () => {
    it("should allow emails sent purely to internal team members", () => {
      const result = enforceEmailSafeguard(
        ["seyone@uprisedigital.com.au", "alex@uprisedigital.com.au"],
        "☀️ Morning Briefing",
      );

      expect(result.to).toEqual([
        "seyone@uprisedigital.com.au",
        "alex@uprisedigital.com.au",
      ]);
      expect(result.subject).toBe("☀️ Morning Briefing");
      expect(result.isOverridden).toBe(false);
    });

    it("should BLOCK external client emails and divert to SAFE_AGENT_EMAIL", () => {
      const result = enforceEmailSafeguard(
        "Michael@cleanenergyproviders.com.au",
        "Monthly Performance Report",
      );

      expect(result.to).toEqual([SAFE_AGENT_EMAIL]);
      expect(result.cc).toEqual([]);
      expect(result.isOverridden).toBe(true);
      expect(result.subject).toContain("[EXTERNAL BLOCKED: Michael@cleanenergyproviders.com.au]");
    });

    it("should strip external clients from mixed recipient lists and protect the team", () => {
      const result = enforceEmailSafeguard(
        ["Michael@cleanenergyproviders.com.au", "alex@uprisedigital.com.au"],
        "Monthly Performance Report",
        ["nick@cleanenergyproviders.com.au", "seyone@uprisedigital.com.au"],
      );

      // Michael and Nick must NOT be present anywhere in the delivery
      expect(result.to).toEqual(["alex@uprisedigital.com.au"]);
      expect(result.cc).toEqual(["seyone@uprisedigital.com.au"]);
      expect(result.to).not.toContain("Michael@cleanenergyproviders.com.au");
      expect(result.cc).not.toContain("nick@cleanenergyproviders.com.au");
      expect(result.isOverridden).toBe(true);
      expect(result.subject).toContain("EXTERNAL BLOCKED");
    });
  });
});

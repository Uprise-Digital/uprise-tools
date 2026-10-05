import { describe, expect, it } from "vitest";
import {
  extractCleanNotesText,
  extractTargetsFromNotes,
  getEffectiveAccountTargetCpa,
} from "@/lib/target-extractor";

describe("Target Extractor from Freeform Notes", () => {
  it("should extract target CPL from 'Google ads - $450 for now'", () => {
    const raw = "Google ads - $450 for now";
    const result = extractTargetsFromNotes(raw);

    expect(result.googleTargetCpa).toBe(450);
    expect(result.generalTargetCpa).toBe(450);
    expect(result.cleanNotes).toBe("Google ads - $450 for now");
  });

  it("should parse multi-platform targets like 'Google: $450, Meta: $120'", () => {
    const raw = "Google: $450, Meta: $120";
    const result = extractTargetsFromNotes(raw);

    expect(result.googleTargetCpa).toBe(450);
    expect(result.metaTargetCpa).toBe(120);
  });

  it("should parse generic target CPL patterns like 'Target CPL: $350.50'", () => {
    const raw = "Target CPL: $350.50";
    const result = extractTargetsFromNotes(raw);

    expect(result.generalTargetCpa).toBe(350.5);
  });

  it("should handle JSON-stringified buyer persona notes", () => {
    const jsonNotes = JSON.stringify({
      notes: "Google ads - $450 for now",
      targetBuyer: "Homeowners looking for solar",
    });

    const clean = extractCleanNotesText(jsonNotes);
    expect(clean).toBe("Google ads - $450 for now");

    const result = extractTargetsFromNotes(jsonNotes);
    expect(result.googleTargetCpa).toBe(450);
  });

  it("should prioritize explicit targetCpa over note extracted values", () => {
    const account = {
      targetCpa: "300",
      targetNotes: "Google ads - $450 for now",
    };

    const effective = getEffectiveAccountTargetCpa(account);
    expect(effective.effectiveCpa).toBe(300);
    expect(effective.source).toBe("explicit");
    expect(effective.isCustom).toBe(true);
  });

  it("should fall back to extracted note target when targetCpa is null", () => {
    const account = {
      targetCpa: null,
      targetNotes: "Google ads - $450 for now",
    };

    const effective = getEffectiveAccountTargetCpa(account);
    expect(effective.effectiveCpa).toBe(450);
    expect(effective.source).toBe("extracted_google");
    expect(effective.isCustom).toBe(true);
  });

  it("should fall back to default 150 when neither is provided", () => {
    const account = {
      targetCpa: null,
      targetNotes: "General brand awareness only",
    };

    const effective = getEffectiveAccountTargetCpa(account);
    expect(effective.effectiveCpa).toBe(150);
    expect(effective.source).toBe("default");
    expect(effective.isCustom).toBe(false);
  });
});

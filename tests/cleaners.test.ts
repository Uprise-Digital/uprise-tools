import { describe, expect, it } from "vitest";
import { cleanCcEmails } from "@/lib/cleaners";

describe("cleanCcEmails", () => {
  it("should return undefined for empty or whitespace strings", () => {
    expect(cleanCcEmails("")).toBeUndefined();
    expect(cleanCcEmails("   ")).toBeUndefined();
    expect(cleanCcEmails(null)).toBeUndefined();
    expect(cleanCcEmails(undefined)).toBeUndefined();
  });

  it("should split single email correctly", () => {
    expect(cleanCcEmails("team@uprise.com.au")).toEqual(["team@uprise.com.au"]);
  });

  it("should split multiple emails separated by commas", () => {
    expect(cleanCcEmails("seyone@uprise.com.au, alex@uprise.com.au")).toEqual([
      "seyone@uprise.com.au",
      "alex@uprise.com.au",
    ]);
  });

  it("should split multiple emails separated by semicolons or mixed delimiters", () => {
    expect(
      cleanCcEmails(
        "seyone@uprise.com.au; alex@uprise.com.au, boss@uprise.com.au",
      ),
    ).toEqual([
      "seyone@uprise.com.au",
      "alex@uprise.com.au",
      "boss@uprise.com.au",
    ]);
  });

  it("should filter out empty items from trailing delimiters or spaces", () => {
    expect(cleanCcEmails(" a@b.com , ; c@d.com ; ")).toEqual([
      "a@b.com",
      "c@d.com",
    ]);
  });
});

import { describe, expect, it } from "vitest";
import { compileOnboardingEmail } from "@/lib/onboarding-email";

describe("Agency Branding & White-Labeling Engine", () => {
  it("should compile onboarding email using dynamic agency name, signature, and logo", () => {
    const result = compileOnboardingEmail({
      primaryContactName: "Alex Smith",
      clientName: "Acme Corp",
      driveFolderLink: "https://drive.google.com/drive/folders/123",
      notionDashboardLink: "https://notion.so/acme-123",
      signalGroupLink: "https://signal.group/#123",
      googleAdsAccess: true,
      metaAdsAccess: false,
      orgName: "Apex Growth Marketing",
      emailSignature:
        "Jane Doe\nHead of Client Success | Apex Growth Marketing\nwww.apexgrowth.com",
      websiteUrl: "https://www.apexgrowth.com",
      logoUrl: "https://cdn.apexgrowth.com/logo.png",
    });

    expect(result.text).toContain("Apex Growth Marketing x Acme Corp");
    expect(result.text).toContain(
      "Jane Doe\nHead of Client Success | Apex Growth Marketing",
    );
    expect(result.html).toContain("https://cdn.apexgrowth.com/logo.png");
    expect(result.html).toContain("Apex Growth Marketing");
    expect(result.html).toContain("Jane Doe<br/>Head of Client Success");
  });

  it("should fallback gracefully when signature or logo is omitted", () => {
    const result = compileOnboardingEmail({
      primaryContactName: "Bob Taylor",
      clientName: "Starlight Ltd",
      driveFolderLink: "https://drive.google.com/folder",
      notionDashboardLink: "https://notion.so/starlight",
      signalGroupLink: "https://signal.group/#456",
      googleAdsAccess: false,
      metaAdsAccess: false,
      orgName: "Elevate Media",
    });

    expect(result.text).toContain("Elevate Media Team");
    expect(result.html).toContain("Elevate Media Team");
    expect(result.html).not.toContain("<img src=");
  });
});

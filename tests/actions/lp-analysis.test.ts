import { describe, expect, it } from "vitest";
import * as cheerio from "cheerio";
import {
  getAuditDetailAction,
  getCampaignLandingPagesAction,
  runLandingPageAuditAction,
  saveCampaignLandingPageAction,
  syncCampaignLandingPagesAction,
} from "@/actions/lp-analysis.actions";

function isElementHidden(el: any, $: any): boolean {
  let current = el;
  let isProgressiveDisclosure = false;
  while (current && current.length > 0) {
    const className = current.attr("class") || "";
    const idName = current.attr("id") || "";
    const role = current.attr("role") || "";
    if (
      /(?:^|[^a-zA-Z0-9])(accordion|tab|tabs|collapse|collapsed|faq|faqs|dropdown)(?:$|[^a-zA-Z0-9])/i.test(className) ||
      /(?:^|[^a-zA-Z0-9])(accordion|tab|tabs|collapse|collapsed|faq|faqs|dropdown)(?:$|[^a-zA-Z0-9])/i.test(idName) ||
      role === "tabpanel"
    ) {
      isProgressiveDisclosure = true;
      break;
    }
    const parentNode = current.parent();
    if (parentNode && parentNode.length > 0) {
      const pNode = parentNode[0];
      if (pNode && pNode.type !== "root" && pNode.name !== "body" && pNode.name !== "html") {
        current = parentNode;
      } else {
        break;
      }
    } else {
      break;
    }
  }

  if (isProgressiveDisclosure) {
    if (el.hasClass("sr-only") || el.hasClass("screen-reader-only")) {
      return true;
    }
    return false;
  }

  const style = el.attr("style") || "";
  if (
    /display\s*:\s*none/i.test(style) ||
    /visibility\s*:\s*hidden/i.test(style) ||
    el.attr("aria-hidden") === "true" ||
    el.prop("hidden") === true ||
    el.hasClass("hidden") ||
    el.hasClass("d-none") ||
    el.hasClass("invisible") ||
    el.hasClass("sr-only") ||
    el.hasClass("screen-reader-only") ||
    el.hasClass("hide")
  ) {
    return true;
  }

  const parent = el.parent();
  if (parent && parent.length > 0) {
    const parentNode = parent[0];
    if (parentNode && parentNode.type !== "root" && parentNode.name !== "body" && parentNode.name !== "html") {
      return isElementHidden(parent, $);
    }
  }

  return false;
}

describe("Landing Page CRO Analysis Actions", () => {
  it("should retrieve campaign landing pages and attach latest audit scores", async () => {
    const result = await getCampaignLandingPagesAction(1);

    if (!result.success) throw new Error(result.error);
    expect(result.data).toBeDefined();
    expect(result.data.length).toBeGreaterThan(0);

    const campaign = result.data[0];
    expect(campaign.campaignId).toBe("camp-1");
    expect(campaign.latestAudit).not.toBeNull();
    expect(campaign.latestAudit?.score).toBe(85);
  });

  it("should sync landing pages from Google Ads API", async () => {
    const result = await syncCampaignLandingPagesAction(1);

    if (!result.success) throw new Error(result.error);
    expect(result.count).toBe(1);
  });

  it("should connect a landing page URL manually to a campaign", async () => {
    const result = await saveCampaignLandingPageAction(
      1,
      "camp-1",
      "Plumbing Campaign",
      "https://test-client.com.au/plumbing-v2",
    );

    if (!result.success) throw new Error(result.error);
    expect(result.data).toBeDefined();
  });

  it("should fail to save manual URLs that do not begin with http/https protocols", async () => {
    const result = await saveCampaignLandingPageAction(
      1,
      "camp-1",
      "Plumbing Campaign",
      "test-client.com.au/plumbing",
    );

    if (result.success) throw new Error("Expected failure");
    expect(result.error).toContain("URL must begin with http:// or https://");
  });

  it("should run a landing page audit, fetch competitors, evaluate dimensions using Gemini, and save to DB", async () => {
    const result = await runLandingPageAuditAction(
      1,
      "camp-1",
      "Plumbing Campaign",
      "https://test-client.com.au/plumbing",
      "emergency plumber gold coast",
    );

    if (!result.success) throw new Error(result.error);
    expect(result.data.auditId).toBeDefined();
    expect(result.data.score).toBe(85);
  });

  it("should retrieve detailed audit report by ID", async () => {
    const result = await getAuditDetailAction(100);

    if (!result.success) throw new Error(result.error);
    expect(result.data).toBeDefined();
    expect(result.data.score).toBe(85);
    expect(result.data.heroScore).toBe(8);
    expect(result.data.ctaScore).toBe(9);
  });

  describe("Scraper DOM Visibility Filtering", () => {
    it("should ignore standard hidden components", () => {
      const $ = cheerio.load(`
        <div>
          <h1 class="hidden">Hidden Title</h1>
          <h2 style="display: none">Hidden Subtitle</h2>
          <div class="d-none">
            <h3>Hidden Nested Header</h3>
          </div>
        </div>
      `);

      expect(isElementHidden($("h1"), $)).toBe(true);
      expect(isElementHidden($("h2"), $)).toBe(true);
      expect(isElementHidden($("h3"), $)).toBe(true);
    });

    it("should preserve accessible accordions even if collapsed with aria-hidden", () => {
      const $ = cheerio.load(`
        <div class="faq-accordion">
          <div class="accordion-item">
            <div class="accordion-content" aria-hidden="true" style="display: none;">
              <h3>Accordion FAQ text</h3>
            </div>
          </div>
        </div>
      `);

      // Under-reporting fix: collapsed progressive content is kept
      expect(isElementHidden($("h3"), $)).toBe(false);
    });

    it("should not collide with tables containing substring 'tab'", () => {
      const $ = cheerio.load(`
        <div class="pricing-table">
          <table class="data-table">
            <tr class="mobile-only d-none" style="display: none;">
              <td>Phantom Mobile Copy</td>
            </tr>
            <tr class="desktop-only">
              <td>Visible Desktop Copy</td>
            </tr>
          </table>
        </div>
      `);

      // Collision check: tables should NOT be treated as progressive tabs/accordions.
      // The hidden mobile row should be correctly hidden.
      expect(isElementHidden($("tr.mobile-only td"), $)).toBe(true);
      expect(isElementHidden($("tr.desktop-only td"), $)).toBe(false);
    });
  });
});

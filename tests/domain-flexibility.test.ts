import { describe, expect, it, vi } from "vitest";
import { getAppUrl } from "@/lib/app-url";

describe("Domain & Hostname Flexibility", () => {
  it("should return NEXT_PUBLIC_APP_URL when configured", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.clientagency.com");
    expect(getAppUrl()).toBe("https://app.clientagency.com");
    vi.unstubAllEnvs();
  });

  it("should strip trailing slashes from environment URLs", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.clientagency.com///");
    expect(getAppUrl()).toBe("https://app.clientagency.com");
    vi.unstubAllEnvs();
  });

  it("should fall back to RAILWAY_PUBLIC_DOMAIN if NEXT_PUBLIC_APP_URL is absent", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.BETTER_AUTH_URL;
    vi.stubEnv("RAILWAY_PUBLIC_DOMAIN", "my-custom-instance.up.railway.app");
    expect(getAppUrl()).toBe("https://my-custom-instance.up.railway.app");
    vi.unstubAllEnvs();
  });
});

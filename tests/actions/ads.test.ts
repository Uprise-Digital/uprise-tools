import { describe, expect, it } from "vitest";
import { syncAdAccountsAction } from "@/actions/ads.actions";

describe("Ad Accounts Synchronization Action", () => {
  it("should trigger MCC sync and write enabled customer clients to DB", async () => {
    const result = await syncAdAccountsAction();

    expect(result.success).toBe(true);
    expect(result.count).toBe(1);
  });
});

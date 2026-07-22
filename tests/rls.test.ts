import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

// Disable global db mock for this database integration test
vi.unmock("@/db");

import { eq, sql } from "drizzle-orm";
import { withBypassTenantDb, withTenantDb } from "../src/db/db-helper";
import { adAccounts, organization } from "../src/db/schema";

const db = (await import("../src/db/index")).db;

describe("Database RLS Scoping Tests", () => {
  beforeAll(async () => {
    // 1. Create a non-superuser role to test RLS (since superuser 'postgres' bypasses RLS)
    await db.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'rls_test_role') THEN
          CREATE ROLE rls_test_role;
        END IF;
      END
      $$;
    `);
    await db.execute(
      sql`GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO rls_test_role`,
    );
    await db.execute(
      sql`GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO rls_test_role`,
    );

    // 2. Clean up any leftover test data
    await withBypassTenantDb(async (tx) => {
      await tx
        .delete(adAccounts)
        .where(eq(adAccounts.name, "RLS Test Account 1"));
      await tx
        .delete(adAccounts)
        .where(eq(adAccounts.name, "RLS Test Account 2"));
      await tx
        .delete(organization)
        .where(eq(organization.id, "org-rls-test-1"));
      await tx
        .delete(organization)
        .where(eq(organization.id, "org-rls-test-2"));

      // 3. Insert test organizations
      await tx.insert(organization).values([
        {
          id: "org-rls-test-1",
          name: "RLS Org 1",
          slug: "rls-org-1",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "org-rls-test-2",
          name: "RLS Org 2",
          slug: "rls-org-2",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      // 4. Insert test ad accounts
      await tx.insert(adAccounts).values([
        {
          googleAccountId: "rls-acc-id-1",
          name: "RLS Test Account 1",
          organizationId: "org-rls-test-1",
          isActive: true,
        },
        {
          googleAccountId: "rls-acc-id-2",
          name: "RLS Test Account 2",
          organizationId: "org-rls-test-2",
          isActive: true,
        },
      ]);
    });
  }, 30000);

  afterAll(async () => {
    // Clean up test data and role
    await withBypassTenantDb(async (tx) => {
      await tx
        .delete(adAccounts)
        .where(eq(adAccounts.name, "RLS Test Account 1"));
      await tx
        .delete(adAccounts)
        .where(eq(adAccounts.name, "RLS Test Account 2"));
      await tx
        .delete(organization)
        .where(eq(organization.id, "org-rls-test-1"));
      await tx
        .delete(organization)
        .where(eq(organization.id, "org-rls-test-2"));
    });
    try {
      await db.execute(
        sql`REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM rls_test_role`,
      );
      await db.execute(
        sql`REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM rls_test_role`,
      );
      await db.execute(sql`DROP ROLE IF EXISTS rls_test_role`);
    } catch (e) {
      console.warn("Could not drop rls_test_role:", e);
    }
  }, 30000);

  test("should enforce RLS and only return Org 1 accounts when scoped to Org 1", async () => {
    const results = await withTenantDb("org-rls-test-1", async (tx) => {
      const beforeRole = await tx.select().from(adAccounts);
      console.log(
        "DEBUG RLS before SET ROLE:",
        beforeRole.filter((a: any) => a.name.includes("RLS")),
      );
      // Switch to standard role so RLS is enforced
      await tx.execute(sql`SET ROLE rls_test_role`);
      const debugVal = await tx.execute(
        sql`SELECT current_setting('app.current_organization_id', true) as val`,
      );
      console.log("DEBUG RLS Org 1 current_setting:", debugVal);
      const rawRes = await tx.execute(sql`SELECT * FROM ad_accounts`);
      console.log("DEBUG RLS rawRes under role:", rawRes);
      const res = await tx.select().from(adAccounts);
      await tx.execute(sql`RESET ROLE`);
      return res;
    });

    expect(results.length).toBe(1);
    expect(results[0].name).toBe("RLS Test Account 1");
    expect(results[0].organizationId).toBe("org-rls-test-1");
  }, 30000);

  test("should enforce RLS and only return Org 2 accounts when scoped to Org 2", async () => {
    const results = await withTenantDb("org-rls-test-2", async (tx) => {
      await tx.execute(sql`SET ROLE rls_test_role`);
      const debugVal = await tx.execute(
        sql`SELECT current_setting('app.current_organization_id', true) as val`,
      );
      console.log("DEBUG RLS Org 2 current_setting:", debugVal);
      const res = await tx.select().from(adAccounts);
      await tx.execute(sql`RESET ROLE`);
      return res;
    });

    expect(results.length).toBe(1);
    expect(results[0].name).toBe("RLS Test Account 2");
    expect(results[0].organizationId).toBe("org-rls-test-2");
  }, 30000);

  test("should return all accounts when RLS is bypassed", async () => {
    const results = await withBypassTenantDb(async (tx) => {
      return await tx
        .select()
        .from(adAccounts)
        .where(sql`name IN ('RLS Test Account 1', 'RLS Test Account 2')`);
    });

    expect(results.length).toBe(2);
  }, 30000);
});

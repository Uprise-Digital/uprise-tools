import { sql } from "drizzle-orm";
import { db } from "./index";

/**
 * Runs a database transaction scoped to a specific organization.
 * PostgreSQL RLS policies will restrict all queries to this organization's data.
 */
export async function withTenantDb<T>(
  orgId: string,
  callback: (tx: typeof db) => Promise<T>,
): Promise<T> {
  return await db.transaction(async (tx) => {
    // Set the session variable for the current transaction using set_config programmatically
    await tx.execute(
      sql`SELECT set_config('app.current_organization_id', ${orgId}, true)`,
    );
    // Run the callback queries inside the transaction context
    return await callback(tx as any);
  });
}

/**
 * Runs a database transaction that bypasses PostgreSQL RLS policies.
 * Useful for global background cron jobs and administration utilities.
 */
export async function withBypassTenantDb<T>(
  callback: (tx: typeof db) => Promise<T>,
): Promise<T> {
  return await db.transaction(async (tx) => {
    // Enable RLS bypass in the current session using set_config
    await tx.execute(sql`SELECT set_config('app.bypass_rls', 'true', true)`);
    return await callback(tx as any);
  });
}

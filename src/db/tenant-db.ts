import { sql } from "drizzle-orm";
import { db } from "./index";

/**
 * Executes database operations inside a Postgres transaction, enforcing the tenant-specific
 * Row-Level Security (RLS) context using SET LOCAL.
 */
export async function withTenantContext<T>(
  organizationId: string,
  callback: (tx: typeof db) => Promise<T>,
): Promise<T> {
  return await db.transaction(async (tx) => {
    // Inject the organization ID context for the duration of this transaction
    await tx.execute(
      sql`SELECT set_config('app.current_organization_id', ${organizationId}, true)`,
    );
    return await callback(tx as any);
  });
}

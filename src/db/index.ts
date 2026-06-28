import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// 1. Create the postgres-js client using your Railway DATABASE_URL
// Disable prefetch as cloud connection proxies can break under serverless setups
const queryClient = postgres(process.env.DATABASE_URL!, { prepare: false });

// 2. Export the db instance with your schema attached for type-safe queries
export const db = drizzle(queryClient, { schema });
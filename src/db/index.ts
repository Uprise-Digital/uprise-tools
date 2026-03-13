import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

// This pulls your Neon connection string from your .env file
const sql = neon(process.env.DATABASE_URL!);

// Export the db instance with our schema attached for type-safe queries
export const db = drizzle(sql, { schema });
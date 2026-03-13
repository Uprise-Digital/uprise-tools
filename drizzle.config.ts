import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

// This ensures Drizzle Kit can read your .env.local file when running terminal commands
dotenv.config({ path: ".env.local" });

export default defineConfig({
    schema: "./src/db/schema.ts", // Or just "./db/schema.ts" if you aren't using a src directory
    out: "./src/db/migrations",   // Where Drizzle stores the SQL history files
    dialect: "postgresql",
    dbCredentials: {
        url: process.env.DATABASE_URL!,
    },
    verbose: true,
    strict: true,
});
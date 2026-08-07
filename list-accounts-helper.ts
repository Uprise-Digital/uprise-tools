import * as dotenv from "dotenv";
import { db } from "./src/db";

dotenv.config({ path: ".env.local" });

async function run() {
  try {
    const accounts = await db.query.adAccounts.findMany({
      columns: {
        id: true,
        name: true,
        googleAccountId: true,
        currencyCode: true,
        isActive: true,
      },
      orderBy: (adAccounts, { asc }) => [asc(adAccounts.name)],
    });
    console.log(JSON.stringify(accounts, null, 2));
  } catch (error) {
    console.error("Error executing query:", error);
  }
}

run().catch(console.error);

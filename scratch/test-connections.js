const { Client } = require("@neondatabase/serverless");

const OLD_URL =
  "postgresql://neondb_owner:npg_v2g3tcUYsSWN@ep-rough-morning-a7wc8fa9-pooler.ap-southeast-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const NEW_URL =
  "postgresql://postgres:YuUbgLHOkdYSwaXwiyYiAXrhTwjRuBWs@thomas.proxy.rlwy.net:19360/railway";

async function run() {
  console.log("Connecting to old database...");
  const oldClient = new Client({ connectionString: OLD_URL });
  await oldClient.connect();
  console.log("Connected to old database!");

  const oldTablesRes = await oldClient.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
  `);
  console.log(
    "Old DB Tables:",
    oldTablesRes.rows.map((r) => r.table_name),
  );

  console.log("\nConnecting to new database...");
  const newClient = new Client({ connectionString: NEW_URL });
  await newClient.connect();
  console.log("Connected to new database!");

  const newTablesRes = await newClient.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
  `);
  console.log(
    "New DB Tables:",
    newTablesRes.rows.map((r) => r.table_name),
  );

  await oldClient.end();
  await newClient.end();
}

run().catch(console.error);

import postgres from "postgres";

async function main() {
  const url =
    process.env.DATABASE_URL ||
    "postgresql://postgres:hpfyOhKvGsQkhsutEPtHaEdItvSHfIRt@tokaido.proxy.rlwy.net:31182/railway";
  console.log("Connecting to:", url);
  const sql = postgres(url);
  try {
    const result = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `;
    console.log("Tables in database:");
    for (const r of result) {
      console.log(` - ${r.table_name}`);
    }
  } catch (err) {
    console.error(err);
  } finally {
    await sql.end();
  }
}

main();

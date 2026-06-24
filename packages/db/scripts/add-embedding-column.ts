import 'dotenv/config';
import postgres from 'postgres';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("❌ DATABASE_URL is not defined in environment.");
  process.exit(1);
}

const sql = postgres(connectionString);

async function main() {
  console.log("🌱 Altering bible_verses table to add embedding column...");
  await sql`ALTER TABLE bible_verses ADD COLUMN IF NOT EXISTS embedding jsonb;`;
  console.log("✅ Successfully altered bible_verses table!");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Failed to alter table:", err);
  process.exit(1);
});

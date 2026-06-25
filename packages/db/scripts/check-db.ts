import 'dotenv/config';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createDb } from '../src/index.ts';
import { bibleVerses, bibleBooks } from '../src/schema.ts';
import { count } from 'drizzle-orm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const DATABASE_URL = process.env.DATABASE_URL;

async function main() {
  console.log('🔗 Connecting to database...');
  const db = createDb(DATABASE_URL);

  try {
    const booksCountResult = await db.select({ count: count() }).from(bibleBooks);
    console.log(`📚 Total Books in db: ${booksCountResult[0].count}`);

    const versesCountResult = await db.select({ count: count() }).from(bibleVerses);
    console.log(`📖 Total Verses in db: ${versesCountResult[0].count}`);
  } catch (err) {
    console.error('❌ Failed to query database:', err);
  }
  process.exit(0);
}

main();

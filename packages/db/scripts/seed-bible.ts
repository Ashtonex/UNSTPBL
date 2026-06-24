import 'dotenv/config';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createDb } from '../src/index.ts';
import { bibleBooks } from '../src/schema.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const BIBLE_API_KEY = process.env.BIBLE_API_KEY;
const BIBLE_API_URL = process.env.BIBLE_API_URL || 'https://rest.api.bible/v1';
const BIBLE_VERSION_ID = process.env.BIBLE_VERSION_ID || 'de4e12af7f28f599-01';
const DATABASE_URL = process.env.DATABASE_URL;

const NT_BOOKS = new Set([
  'MAT', 'MRK', 'LUK', 'JHN', 'ACT', 'ROM', '1CO', '2CO', 'GAL', 'EPH',
  'PHP', 'COL', '1TH', '2TH', '1TI', '2TI', 'TIT', 'PHM', 'HEB', 'JAS',
  '1PE', '2PE', '1JN', '2JN', '3JN', 'JUD', 'REV'
]);

async function main() {
  if (!BIBLE_API_KEY) {
    console.error('❌ BIBLE_API_KEY is not defined in environment variables.');
    process.exit(1);
  }

  console.log('🌱 Seeding Bible books...');
  console.log(`Connecting to database...`);
  const db = createDb(DATABASE_URL);

  try {
    // Check if books are already seeded
    const existingBooks = await db.select().from(bibleBooks).limit(1);
    if (existingBooks.length > 0) {
      console.log('✅ Bible books already seeded. Skipping.');
      process.exit(0);
    }
  } catch (err) {
    console.warn('Could not query bible_books, proceeding anyway...', err);
  }

  console.log(`Fetching books from Bible API (${BIBLE_API_URL}/bibles/${BIBLE_VERSION_ID}/books)...`);
  const url = `${BIBLE_API_URL}/bibles/${BIBLE_VERSION_ID}/books`;
  const response = await fetch(url, {
    headers: {
      'api-key': BIBLE_API_KEY
    }
  });

  if (!response.ok) {
    console.error(`❌ Failed to fetch books: ${response.status} ${response.statusText}`);
    const text = await response.text();
    console.error(text);
    process.exit(1);
  }

  const result = await response.json() as { data: Array<{ id: string; name: string; abbreviation: string }> };
  const apiBooks = result.data;

  if (!apiBooks || apiBooks.length === 0) {
    console.error('❌ No books returned from Bible API.');
    process.exit(1);
  }

  console.log(`Found ${apiBooks.length} books. Inserting into database...`);

  // Map to DB schema
  const booksToInsert = apiBooks.map((book) => {
    const testament: 'old' | 'new' = NT_BOOKS.has(book.id) ? 'new' : 'old';
    return {
      name: book.name,
      abbreviation: book.id, // Store API book ID (e.g. 'GEN') as abbreviation for easier API mapping
      testament,
    };
  });

  await db.insert(bibleBooks).values(booksToInsert);

  console.log('✅ Bible books successfully seeded!');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});

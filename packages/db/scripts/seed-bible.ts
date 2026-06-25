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

const LOCAL_BOOKS = [
  { name: 'Genesis', abbreviation: 'GEN', testament: 'old' },
  { name: 'Exodus', abbreviation: 'EXO', testament: 'old' },
  { name: 'Leviticus', abbreviation: 'LEV', testament: 'old' },
  { name: 'Numbers', abbreviation: 'NUM', testament: 'old' },
  { name: 'Deuteronomy', abbreviation: 'DEU', testament: 'old' },
  { name: 'Joshua', abbreviation: 'JOS', testament: 'old' },
  { name: 'Judges', abbreviation: 'JDG', testament: 'old' },
  { name: 'Ruth', abbreviation: 'RUT', testament: 'old' },
  { name: '1 Samuel', abbreviation: '1SA', testament: 'old' },
  { name: '2 Samuel', abbreviation: '2SA', testament: 'old' },
  { name: '1 Kings', abbreviation: '1KI', testament: 'old' },
  { name: '2 Kings', abbreviation: '2KI', testament: 'old' },
  { name: '1 Chronicles', abbreviation: '1CH', testament: 'old' },
  { name: '2 Chronicles', abbreviation: '2CH', testament: 'old' },
  { name: 'Ezra', abbreviation: 'EZR', testament: 'old' },
  { name: 'Nehemiah', abbreviation: 'NEH', testament: 'old' },
  { name: 'Esther', abbreviation: 'EST', testament: 'old' },
  { name: 'Job', abbreviation: 'JOB', testament: 'old' },
  { name: 'Psalms', abbreviation: 'PSA', testament: 'old' },
  { name: 'Proverbs', abbreviation: 'PRO', testament: 'old' },
  { name: 'Ecclesiastes', abbreviation: 'ECC', testament: 'old' },
  { name: 'Song of Solomon', abbreviation: 'SNG', testament: 'old' },
  { name: 'Isaiah', abbreviation: 'ISA', testament: 'old' },
  { name: 'Jeremiah', abbreviation: 'JER', testament: 'old' },
  { name: 'Lamentations', abbreviation: 'LAM', testament: 'old' },
  { name: 'Ezekiel', abbreviation: 'EZK', testament: 'old' },
  { name: 'Daniel', abbreviation: 'DAN', testament: 'old' },
  { name: 'Hosea', abbreviation: 'HOS', testament: 'old' },
  { name: 'Joel', abbreviation: 'JOL', testament: 'old' },
  { name: 'Amos', abbreviation: 'AMO', testament: 'old' },
  { name: 'Obadiah', abbreviation: 'OBD', testament: 'old' },
  { name: 'Jonah', abbreviation: 'JON', testament: 'old' },
  { name: 'Micah', abbreviation: 'MIC', testament: 'old' },
  { name: 'Nahum', abbreviation: 'NAM', testament: 'old' },
  { name: 'Habakkuk', abbreviation: 'HAB', testament: 'old' },
  { name: 'Zephaniah', abbreviation: 'ZEP', testament: 'old' },
  { name: 'Haggai', abbreviation: 'HAG', testament: 'old' },
  { name: 'Zechariah', abbreviation: 'ZEC', testament: 'old' },
  { name: 'Malachi', abbreviation: 'MAL', testament: 'old' },
  { name: 'Matthew', abbreviation: 'MAT', testament: 'new' },
  { name: 'Mark', abbreviation: 'MRK', testament: 'new' },
  { name: 'Luke', abbreviation: 'LUK', testament: 'new' },
  { name: 'John', abbreviation: 'JHN', testament: 'new' },
  { name: 'Acts', abbreviation: 'ACT', testament: 'new' },
  { name: 'Romans', abbreviation: 'ROM', testament: 'new' },
  { name: '1 Corinthians', abbreviation: '1CO', testament: 'new' },
  { name: '2 Corinthians', abbreviation: '2CO', testament: 'new' },
  { name: 'Galatians', abbreviation: 'GAL', testament: 'new' },
  { name: 'Ephesians', abbreviation: 'EPH', testament: 'new' },
  { name: 'Philippians', abbreviation: 'PHP', testament: 'new' },
  { name: 'Colossians', abbreviation: 'COL', testament: 'new' },
  { name: '1 Thessalonians', abbreviation: '1TH', testament: 'new' },
  { name: '2 Thessalonians', abbreviation: '2TH', testament: 'new' },
  { name: '1 Timothy', abbreviation: '1TI', testament: 'new' },
  { name: '2 Timothy', abbreviation: '2TI', testament: 'new' },
  { name: 'Titus', abbreviation: 'TIT', testament: 'new' },
  { name: 'Philemon', abbreviation: 'PHM', testament: 'new' },
  { name: 'Hebrews', abbreviation: 'HEB', testament: 'new' },
  { name: 'James', abbreviation: 'JAS', testament: 'new' },
  { name: '1 Peter', abbreviation: '1PE', testament: 'new' },
  { name: '2 Peter', abbreviation: '2PE', testament: 'new' },
  { name: '1 John', abbreviation: '1JN', testament: 'new' },
  { name: '2 John', abbreviation: '2JN', testament: 'new' },
  { name: '3 John', abbreviation: '3JN', testament: 'new' },
  { name: 'Jude', abbreviation: 'JUD', testament: 'new' },
  { name: 'Revelation', abbreviation: 'REV', testament: 'new' },
] as const;

async function main() {
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

  if (!BIBLE_API_KEY) {
    console.warn('⚠️ BIBLE_API_KEY is not defined in environment variables.');
    console.log('🌱 Seeding 66 Bible books from local list...');
    await db.insert(bibleBooks).values(LOCAL_BOOKS);
    console.log('✅ Bible books successfully seeded from local list!');
    process.exit(0);
  }

  console.log(`Fetching books from Bible API (${BIBLE_API_URL}/bibles/${BIBLE_VERSION_ID}/books)...`);
  try {
    const url = `${BIBLE_API_URL}/bibles/${BIBLE_VERSION_ID}/books`;
    const response = await fetch(url, {
      headers: {
        'api-key': BIBLE_API_KEY
      }
    });

    if (!response.ok) {
      console.warn(`⚠️ Failed to fetch books from Bible API: ${response.status} ${response.statusText}`);
      console.log('🌱 Seeding 66 Bible books from local list...');
      await db.insert(bibleBooks).values(LOCAL_BOOKS);
      console.log('✅ Bible books successfully seeded from local list!');
      process.exit(0);
    }

    const result = await response.json() as { data: Array<{ id: string; name: string; abbreviation: string }> };
    const apiBooks = result.data;

    if (!apiBooks || apiBooks.length === 0) {
      console.warn('⚠️ No books returned from Bible API.');
      console.log('🌱 Seeding 66 Bible books from local list...');
      await db.insert(bibleBooks).values(LOCAL_BOOKS);
      console.log('✅ Bible books successfully seeded from local list!');
      process.exit(0);
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
    console.log('✅ Bible books successfully seeded from Bible API!');
    process.exit(0);
  } catch (fetchErr) {
    console.error('❌ Error during Bible API fetch. Seeding local list instead:', fetchErr);
    await db.insert(bibleBooks).values(LOCAL_BOOKS);
    console.log('✅ Bible books successfully seeded from local list!');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});

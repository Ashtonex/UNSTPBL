import 'dotenv/config';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createDb } from '../src/index.ts';
import { bibleBooks, bibleVerses } from '../src/schema.ts';
import { eq, and, count } from 'drizzle-orm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const DATABASE_URL = process.env.DATABASE_URL;
const KJV_JSON_URL = 'https://raw.githubusercontent.com/thiagobodruk/bible/master/json/en_kjv.json';

const LOCAL_BIBLE_BOOKS = [
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
  { name: 'Revelation', abbreviation: 'REV', testament: 'new' }
] as const;

// Helper to normalize book names
const bookNameMap: Record<string, string> = {
  'gn': 'GEN', 'ex': 'EXO', 'lv': 'LEV', 'nm': 'NUM', 'dt': 'DEU', 'js': 'JOS', 'jg': 'JDG', 'jud': 'JDG', 'rt': 'RUT',
  '1s': '1SA', '1sm': '1SA', '2s': '2SA', '2sm': '2SA', '1k': '1KI', '1kgs': '1KI', '2k': '2KI', '2kgs': '2KI',
  '1ch': '1CH', '2ch': '2CH', 'ez': 'EZR', 'ezr': 'EZR', 'ne': 'NEH', 'et': 'EST', 'jb': 'JOB', 'job': 'JOB',
  'ps': 'PSA', 'pr': 'PRO', 'prv': 'PRO', 'ec': 'ECC', 'ca': 'SNG', 'so': 'SNG', 'is': 'ISA', 'jr': 'JER',
  'lm': 'LAM', 'ezk': 'EZK', 'dn': 'DAN', 'hs': 'HOS', 'ho': 'HOS', 'jl': 'JOL', 'am': 'AMO', 'ob': 'OBA',
  'jn': 'JON', 'mc': 'MIC', 'mi': 'MIC', 'na': 'NAM', 'hk': 'HAB', 'zp': 'ZEP', 'hg': 'HAG', 'zc': 'ZEC',
  'ml': 'MAL', 'mt': 'MAT', 'mk': 'MRK', 'lk': 'LUK', 'jo': 'JHN', 'act': 'ACT', 'ac': 'ACT', 'rm': 'ROM',
  '1co': '1CO', '2co': '2CO', 'gl': 'GAL', 'ep': 'EPH', 'eph': 'EPH', 'ph': 'PHP', 'cl': 'COL',
  '1th': '1TH', '1ts': '1TH', '2th': '2TH', '2ts': '2TH', '1ti': '1TI', '1tm': '1TI', '2ti': '2TI', '2tm': '2TI',
  'tt': 'TIT', 'phm': 'PHM', 'hb': 'HEB', 'jm': 'JAS', '1pe': '1PE', '2pe': '2PE',
  '1jn': '1JN', '1jo': '1JN', '2jn': '2JN', '2jo': '2JN', '3jn': '3JN', '3jo': '3JN', 'jd': 'JUD', 'rv': 'REV', 're': 'REV'
};

async function main() {
  console.log('🔗 Connecting to database...');
  const db = createDb(DATABASE_URL);

  // 1. Ensure Books are Seeded
  try {
    const existingBooks = await db.select().from(bibleBooks).limit(1);
    if (existingBooks.length === 0) {
      console.log('🌱 Seeding Bible books first...');
      await db.insert(bibleBooks).values(LOCAL_BIBLE_BOOKS);
      console.log('✅ Bible books seeded.');
    } else {
      console.log('✅ Bible books already seeded.');
    }
  } catch (err) {
    console.error('❌ Failed to check/seed Bible books:', err);
    process.exit(1);
  }

  // 2. Fetch all books from DB to get their IDs
  const dbBooks = await db.select().from(bibleBooks);
  const abbrevToIdMap = new Map<string, number>();
  dbBooks.forEach((book) => {
    abbrevToIdMap.set(book.abbreviation.toUpperCase(), book.id);
  });

  // 3. Check if we already have seeded KJV verses
  try {
    const existingVersesCount = await db
      .select({ value: count() })
      .from(bibleVerses)
      .where(eq(bibleVerses.translation, 'KJV'));
      
    if (existingVersesCount[0].value >= 30000) {
      console.log(`✅ KJV Bible verses are already seeded (${existingVersesCount[0].value} verses). Skipping full seed.`);
      process.exit(0);
    }
  } catch (err) {
    console.warn('Could not query bible_verses table. Check if migrations were run.', err);
    process.exit(1);
  }

  // 4. Download Full Bible JSON
  console.log(`🌐 Downloading KJV Bible JSON from ${KJV_JSON_URL}...`);
  const response = await fetch(KJV_JSON_URL);
  if (!response.ok) {
    console.error(`❌ Failed to download KJV Bible: ${response.status} ${response.statusText}`);
    process.exit(1);
  }

  interface RawBook {
    abbrev: string;
    book: string;
    chapters: string[][];
  }

  const rawBible = (await response.json()) as RawBook[];
  console.log(`📦 Loaded ${rawBible.length} books from JSON. Preparing batch insert...`);

  // 5. Build verses array for inserting
  const versesToInsert: Array<{
    bookId: number;
    chapter: number;
    verseNumber: number;
    text: string;
    translation: string;
  }> = [];

  for (const rawBook of rawBible) {
    const abbrev = bookNameMap[rawBook.abbrev.toLowerCase()];
    if (!abbrev) {
      console.warn(`⚠️ Unknown book abbreviation in raw JSON: ${rawBook.abbrev}`);
      continue;
    }

    const bookId = abbrevToIdMap.get(abbrev);
    if (!bookId) {
      console.warn(`⚠️ Book abbreviation ${abbrev} not found in database bible_books.`);
      continue;
    }

    rawBook.chapters.forEach((chapterVerses, cIdx) => {
      const chapterNum = cIdx + 1;
      chapterVerses.forEach((verseText, vIdx) => {
        const verseNum = vIdx + 1;
        versesToInsert.push({
          bookId,
          chapter: chapterNum,
          verseNumber: verseNum,
          text: verseText.trim(),
          translation: 'KJV',
        });
      });
    });
  }

  console.log(`🚀 Ready to insert ${versesToInsert.length} verses into database.`);

  // 6. Bulk insert in batches to prevent query size limit issues
  const BATCH_SIZE = 1000;
  let insertedCount = 0;

  for (let i = 0; i < versesToInsert.length; i += BATCH_SIZE) {
    const chunk = versesToInsert.slice(i, i + BATCH_SIZE);
    try {
      await db.insert(bibleVerses).values(chunk).onConflictDoNothing();
      insertedCount += chunk.length;
      if (insertedCount % 5000 === 0 || insertedCount === versesToInsert.length) {
        console.log(`⚡ Seeded ${insertedCount}/${versesToInsert.length} verses...`);
      }
    } catch (insertErr) {
      console.error(`❌ Failed to insert batch starting at index ${i}:`, insertErr);
      process.exit(1);
    }
  }

  console.log('🎉 Offline KJV Bible verses seeded successfully!');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});

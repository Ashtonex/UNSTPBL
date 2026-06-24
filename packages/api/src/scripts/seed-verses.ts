import 'dotenv/config';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from '../lib/db.js';
import { bibleVerses, bibleBooks } from '@unstpbl/db';
import { getEmbedding } from '../lib/embeddings.js';
import { eq, and } from '@unstpbl/db';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const CURATED_VERSES = [
  { book: 'JHN', chapter: 3, verse: 16, text: 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.' },
  { book: 'PHP', chapter: 4, verse: 13, text: 'I can do all things through Christ which strengtheneth me.' },
  { book: 'PSA', chapter: 23, verse: 1, text: 'The Lord is my shepherd; I shall not want.' },
  { book: 'PRO', chapter: 3, verse: 5, text: 'Trust in the Lord with all thine heart; and lean not unto thine own understanding.' },
  { book: 'PRO', chapter: 3, verse: 6, text: 'In all thy ways acknowledge him, and he shall direct thy paths.' },
  { book: 'ROM', chapter: 8, verse: 28, text: 'And we know that all things work together for good to them that love God, to them who are the called according to his purpose.' },
  { book: 'JOS', chapter: 1, verse: 9, text: 'Have not I commanded thee? Be strong and of a good courage; be not afraid, neither be thou dismayed: for the Lord thy God is with thee whithersoever thou goest.' },
  { book: 'ISA', chapter: 40, verse: 31, text: 'But they that wait upon the Lord shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary; and they shall walk, and not faint.' },
  { book: 'MAT', chapter: 6, verse: 33, text: 'But seek ye first the kingdom of God, and his righteousness; and all these things shall be added unto you.' },
  { book: 'GAL', chapter: 5, verse: 22, text: 'But the fruit of the Spirit is love, joy, peace, longsuffering, gentleness, goodness, faith,' },
  { book: 'GAL', chapter: 5, verse: 23, text: 'Meekness, temperance: against such there is no law.' },
  { book: 'ROM', chapter: 12, verse: 2, text: 'And be not conformed to this world: but be ye transformed by the renewing of your mind, that ye may prove what is that good, and acceptable, and perfect, will of God.' },
  { book: 'PSA', chapter: 46, verse: 1, text: 'God is our refuge and strength, a very present help in trouble.' },
  { book: '1PE', chapter: 5, verse: 7, text: 'Casting all your care upon him; for he careth for you.' },
  { book: 'HEB', chapter: 11, verse: 1, text: 'Now faith is the substance of things hoped for, the evidence of things not seen.' },
  { book: 'JAS', chapter: 1, verse: 5, text: 'If any of you lack wisdom, let him ask of God, that giveth to all men liberally, and upbraideth not; and it shall be given him.' },
  { book: 'EPH', chapter: 4, verse: 32, text: 'And be ye kind one to another, tenderhearted, forgiving one another, even as God for Christ\'s sake hath forgiven you.' },
  { book: 'MAT', chapter: 11, verse: 28, text: 'Come unto me, all ye that labour and are heavy laden, and I will give you rest.' },
  { book: '2TI', chapter: 1, verse: 7, text: 'For God hath not given us the spirit of fear; but of power, and of love, and of a sound mind.' },
  { book: 'PSA', chapter: 119, verse: 105, text: 'Thy word is a lamp unto my feet, and a light unto my path.' },
  { book: 'PRO', chapter: 4, verse: 23, text: 'Keep thy heart with all diligence; for out of it are the issues of life.' },
  { book: 'COL', chapter: 3, verse: 23, text: 'And whatsoever ye do, do it heartily, as to the Lord, and not unto men;' },
  { book: 'ROM', chapter: 15, verse: 13, text: 'Now the God of hope fill you with all joy and peace in believing, that ye may abound in hope, through the power of the Holy Ghost.' },
  { book: 'DEU', chapter: 31, verse: 6, text: 'Be strong and of a good courage, fear not, nor be afraid of them: for the Lord thy God, he it is that doth go with thee; he will not fail thee, nor forsake thee.' },
  { book: 'ISA', chapter: 41, verse: 10, text: 'Fear thou not; for I am with thee: be not dismayed; for I am thy God: I will strengthen thee; yea, I will help thee; yea, I will uphold thee with the right hand of my righteousness.' },
  { book: 'PHP', chapter: 4, verse: 6, text: 'Be careful for nothing; but in every thing by prayer and supplication with thanksgiving let your requests be made known unto God.' },
  { book: 'PHP', chapter: 4, verse: 7, text: 'And the peace of God, which passeth all understanding, shall keep your hearts and minds through Christ Jesus.' },
  { book: 'MAT', chapter: 7, verse: 7, text: 'Ask, and it shall be given you; seek, and ye shall find; knock, and it shall be opened unto you:' },
  { book: 'ROM', chapter: 5, verse: 8, text: 'But God commendeth his love toward us, in that, while we were yet sinners, Christ died for us.' },
  { book: 'EPH', chapter: 2, verse: 8, text: 'For by grace are ye saved through faith; and that not of yourselves: it is the gift of God:' },
  { book: 'EPH', chapter: 2, verse: 9, text: 'Not of works, lest any man should boast.' },
  { book: 'LAM', chapter: 3, verse: 22, text: 'It is of the Lord\'s mercies that we are not consumed, because his compassions fail not.' },
  { book: '1CO', chapter: 13, verse: 4, text: 'Charity suffereth long, and is kind; charity envieth not; charity vaunteth not itself, is not puffed up,' },
  { book: 'JER', chapter: 29, verse: 11, text: 'For I know the thoughts that I think toward you, saith the Lord, thoughts of peace, and not of evil, to give you an expected end.' }
];

async function main() {
  console.log('🌱 Seeding curated scriptures with pre-calculated semantic embeddings...');
  
  // 1. Fetch bible books to map abbreviations
  const books = await db.select().from(bibleBooks);
  const bookMap = new Map(books.map(b => [b.abbreviation, b.id]));

  for (const item of CURATED_VERSES) {
    const bookId = bookMap.get(item.book);
    if (!bookId) {
      console.warn(`⚠️ Book ${item.book} not found in database. Skipping.`);
      continue;
    }

    // Check if already exists in KJV
    const existing = await db
      .select()
      .from(bibleVerses)
      .where(
        and(
          eq(bibleVerses.bookId, bookId),
          eq(bibleVerses.chapter, item.chapter),
          eq(bibleVerses.verseNumber, item.verse),
          eq(bibleVerses.translation, 'KJV')
        )
      )
      .limit(1);

    if (existing.length > 0) {
      const row = existing[0];
      if (!row.embedding) {
        console.log(`Calculating missing embedding for existing verse: ${item.book} ${item.chapter}:${item.verse}`);
        const embedding = await getEmbedding(row.text);
        await db.update(bibleVerses).set({ embedding }).where(eq(bibleVerses.id, row.id));
      } else {
        console.log(`Verse already exists with embedding: ${item.book} ${item.chapter}:${item.verse}. Skipping.`);
      }
      continue;
    }

    console.log(`Seeding: ${item.book} ${item.chapter}:${item.verse}...`);
    
    // Calculate embedding
    const embedding = await getEmbedding(item.text);

    await db.insert(bibleVerses).values({
      bookId,
      chapter: item.chapter,
      verseNumber: item.verse,
      text: item.text,
      translation: 'KJV',
      embedding,
    });
  }

  console.log('✅ Curated scriptures successfully seeded!');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});

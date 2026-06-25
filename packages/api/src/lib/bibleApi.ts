import 'dotenv/config';

const BIBLE_API_KEY = process.env.BIBLE_API_KEY;
const BIBLE_API_URL = process.env.BIBLE_API_URL || 'https://rest.api.bible/v1';
const BIBLE_VERSION_ID = process.env.BIBLE_VERSION_ID || 'de4e12af7f28f599-01';

export interface BibleApiVerse {
  id: string;
  bibleId: string;
  bookId: string;
  chapterId: string;
  reference: string;
  content: string;
  copyright: string;
}

const BOOK_ABBREVS = [
  'GEN', 'EXO', 'LEV', 'NUM', 'DEU', 'JOS', 'JDG', 'RUT', '1SA', '2SA',
  '1KI', '2KI', '1CH', '2CH', 'EZR', 'NEH', 'EST', 'JOB', 'PSA', 'PRO',
  'ECC', 'SNG', 'ISA', 'JER', 'LAM', 'EZK', 'DAN', 'HOS', 'JOL', 'AMO',
  'OBD', 'JON', 'MIC', 'NAM', 'HAB', 'ZEP', 'HAG', 'ZEC', 'MAL',
  'MAT', 'MRK', 'LUK', 'JHN', 'ACT', 'ROM', '1CO', '2CO', 'GAL', 'EPH',
  'PHP', 'COL', '1TH', '2TH', '1TI', '2TI', 'TIT', 'PHM', 'HEB', 'JAS',
  '1PE', '2PE', '1JN', '2JN', '3JN', 'JUD', 'REV'
];

function getBollsBookNumber(abbrevOrName: string): number {
  const clean = abbrevOrName.trim().toUpperCase();
  
  // Try matching abbreviation
  const abbrevIndex = BOOK_ABBREVS.indexOf(clean);
  if (abbrevIndex !== -1) {
    return abbrevIndex + 1; // 1-indexed book number
  }
  
  // Try matching common names
  const names: Record<string, number> = {
    'GENESIS': 1, 'EXODUS': 2, 'LEVITICUS': 3, 'NUMBERS': 4, 'DEUTERONOMY': 5,
    'JOSHUA': 6, 'JUDGES': 7, 'RUTH': 8, '1 SAMUEL': 9, '2 SAMUEL': 10,
    '1 KINGS': 11, '2 KINGS': 12, '1 CHRONICLES': 13, '2 CHRONICLES': 14,
    'EZRA': 15, 'NEHEMIAH': 16, 'ESTHER': 17, 'JOB': 18, 'PSALMS': 19,
    'PROVERBS': 20, 'ECCLESIASTES': 21, 'SONG OF SOLOMON': 22, 'ISAIAH': 23,
    'JEREMIAH': 24, 'LAMENTATIONS': 25, 'EZEKIEL': 26, 'DANIEL': 27,
    'HOSEA': 28, 'JOEL': 29, 'AMOS': 30, 'OBADIAH': 31, 'JONAH': 32,
    'MICAH': 33, 'NAHUM': 34, 'HABAKKUK': 35, 'ZEPHANIAH': 36, 'HAGGAI': 37,
    'ZECHARIAH': 38, 'MALACHI': 39, 'MATTHEW': 40, 'MARK': 41, 'LUKE': 42,
    'JOHN': 43, 'ACTS': 44, 'ROMANS': 45, '1 CORINTHIANS': 46, '2 CORINTHIANS': 47,
    'GALATIANS': 48, 'EPHESIANS': 49, 'PHILIPPIANS': 50, 'COLOSSIANS': 51,
    '1 THESSALONIANS': 52, '2 THESSALONIANS': 53, '1 TIMOTHY': 54, '2 TIMOTHY': 55,
    'TITUS': 56, 'PHILEMON': 57, 'HEBREWS': 58, 'JAMES': 59, '1 PETER': 60,
    '2 PETER': 61, '1 JOHN': 62, '2 JOHN': 63, '3 JOHN': 64, 'JUDE': 65,
    'REVELATION': 66
  };
  
  return names[clean] || 1;
}

/**
 * Fetches a verse from the free, keyless bolls.life API.
 * Supports standard translations like KJV, ESV, NIV, etc.
 */
export async function fetchVerseFromBollsLife(
  abbrevOrName: string,
  chapter: number,
  verseNumber: number,
  translation: string = 'KJV'
): Promise<string> {
  const bookNum = getBollsBookNumber(abbrevOrName);
  const trans = translation.toUpperCase();
  const url = `https://bolls.life/get-text/${trans}/${bookNum}/${chapter}/${verseNumber}/`;
  
  console.log(`🌐 Fetching free scripture from bolls.life (${trans} Book:${bookNum} ${chapter}:${verseNumber})...`);
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch from bolls.life API: ${response.status} ${response.statusText}`);
  }
  
  const result = (await response.json()) as { text: string };
  if (!result.text) {
    throw new Error(`No verse content returned from bolls.life for book ${bookNum} ${chapter}:${verseNumber}`);
  }
  
  return result.text.trim();
}

/**
 * Fetches a verse from the keyless, open bible-api.com.
 * Fallback translation is WEB (World English Bible) for ESV requests, or KJV.
 */
export async function fetchVerseFromFreeApi(
  bookAbbrev: string,
  chapter: number,
  verseNumber: number,
  translation: string = 'KJV'
): Promise<string> {
  const trans = translation.toUpperCase() === 'ESV' ? 'web' : 'kjv';
  const query = `${bookAbbrev} ${chapter}:${verseNumber}`;
  const url = `https://bible-api.com/${encodeURIComponent(query)}?translation=${trans}`;
  
  console.log(`🌐 Fetching free scripture from bible-api.com (${query}, translation: ${trans})...`);
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch from free Bible API: ${response.status} ${response.statusText}`);
  }
  
  const result = (await response.json()) as { text: string };
  if (!result.text) {
    throw new Error(`No verse content returned from free Bible API for ${query}`);
  }
  
  return result.text.trim();
}

/**
 * Fetches verse from free APIs (Bolls Life first, then bible-api.com).
 */
export async function fetchVerseFromKeylessApis(
  abbrevOrName: string,
  chapter: number,
  verseNumber: number,
  translation: string = 'KJV'
): Promise<string> {
  try {
    return await fetchVerseFromBollsLife(abbrevOrName, chapter, verseNumber, translation);
  } catch (err) {
    console.warn(`⚠️ bolls.life fetch failed, falling back to bible-api.com:`, err);
    return fetchVerseFromFreeApi(abbrevOrName, chapter, verseNumber, translation);
  }
}

export async function fetchVerseFromApi(
  bookAbbrev: string,
  chapter: number,
  verseNumber: number
): Promise<string> {
  if (!BIBLE_API_KEY || BIBLE_API_KEY.includes('YOUR_')) {
    console.warn('⚠️ BIBLE_API_KEY is not defined or is placeholder. Falling back to free keyless APIs...');
    return fetchVerseFromKeylessApis(bookAbbrev, chapter, verseNumber, 'KJV');
  }

  const verseId = `${bookAbbrev}.${chapter}.${verseNumber}`;
  const url = `${BIBLE_API_URL}/bibles/${BIBLE_VERSION_ID}/verses/${verseId}?contentType=text&includeVerseNumbers=false&includeChapterNumbers=false`;

  console.log(`Fetching verse ${verseId} from Bible API...`);

  try {
    const response = await fetch(url, {
      headers: {
        'api-key': BIBLE_API_KEY,
      },
    });

    if (!response.ok) {
      console.warn(`⚠️ Bible API request failed: ${response.status} ${response.statusText}. Falling back to free keyless APIs...`);
      return fetchVerseFromKeylessApis(bookAbbrev, chapter, verseNumber, 'KJV');
    }

    const result = (await response.json()) as { data: BibleApiVerse };
    
    if (!result.data || !result.data.content) {
      console.warn('⚠️ Bible API returned empty content. Falling back to free keyless APIs...');
      return fetchVerseFromKeylessApis(bookAbbrev, chapter, verseNumber, 'KJV');
    }

    // Strip carriage returns and any extra spaces/newlines at start and end
    let text = result.data.content.replace(/\r/g, '').trim();

    // Strip leading verse numbers if the API still includes them despite includeVerseNumbers=false
    text = text.replace(/^\[?\d+\]?\s*/, '').trim();

    return text;
  } catch (err) {
    console.error('❌ Error during Bible API fetch. Falling back to free keyless APIs:', err);
    return fetchVerseFromKeylessApis(bookAbbrev, chapter, verseNumber, 'KJV');
  }
}

export async function fetchVerseFromEsv(
  bookName: string,
  chapter: number,
  verseNumber: number
): Promise<string> {
  const ESV_API_KEY = process.env.ESV_API_KEY;
  if (!ESV_API_KEY || ESV_API_KEY.includes('YOUR_')) {
    console.warn('⚠️ ESV_API_KEY is not defined or is placeholder. Falling back to free keyless APIs...');
    return fetchVerseFromKeylessApis(bookName, chapter, verseNumber, 'ESV');
  }

  const query = encodeURIComponent(`${bookName} ${chapter}:${verseNumber}`);
  const url = `https://api.esv.org/v3/passage/text/?q=${query}&include-verse-numbers=false&include-headings=false&include-footnotes=false&include-passage-references=false&include-short-copyright=false&include-first-verse-numbers=false`;

  console.log(`Fetching verse ${bookName} ${chapter}:${verseNumber} from ESV API...`);

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Token ${ESV_API_KEY}`,
      },
    });

    if (!response.ok) {
      console.warn(`⚠️ ESV API request failed: ${response.status} ${response.statusText}. Falling back to free keyless APIs...`);
      return fetchVerseFromKeylessApis(bookName, chapter, verseNumber, 'ESV');
    }

    const result = (await response.json()) as { passages: string[] };

    if (!result.passages || result.passages.length === 0) {
      console.warn('⚠️ ESV API returned empty content. Falling back to free keyless APIs...');
      return fetchVerseFromKeylessApis(bookName, chapter, verseNumber, 'ESV');
    }

    return result.passages[0].trim();
  } catch (err) {
    console.error('❌ Error during ESV API fetch. Falling back to free keyless APIs:', err);
    return fetchVerseFromKeylessApis(bookName, chapter, verseNumber, 'ESV');
  }
}


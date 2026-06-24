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

export async function fetchVerseFromApi(
  bookAbbrev: string,
  chapter: number,
  verseNumber: number
): Promise<string> {
  if (!BIBLE_API_KEY) {
    throw new Error('BIBLE_API_KEY is not defined in environment variables.');
  }

  const verseId = `${bookAbbrev}.${chapter}.${verseNumber}`;
  const url = `${BIBLE_API_URL}/bibles/${BIBLE_VERSION_ID}/verses/${verseId}?contentType=text&includeVerseNumbers=false&includeChapterNumbers=false`;

  console.log(`Fetching verse ${verseId} from Bible API...`);

  const response = await fetch(url, {
    headers: {
      'api-key': BIBLE_API_KEY,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch verse ${verseId} from Bible API: ${response.status} ${response.statusText}`);
  }

  const result = (await response.json()) as { data: BibleApiVerse };
  
  if (!result.data || !result.data.content) {
    throw new Error(`No verse content returned from Bible API for ${verseId}`);
  }

  // Strip carriage returns and any extra spaces/newlines at start and end
  let text = result.data.content.replace(/\r/g, '').trim();

  // Strip leading verse numbers if the API still includes them despite includeVerseNumbers=false
  // e.g., "[1] Thy word is a lamp..." or "1  Thy word..."
  text = text.replace(/^\[?\d+\]?\s*/, '').trim();

  return text;
}

export async function fetchVerseFromEsv(
  bookName: string,
  chapter: number,
  verseNumber: number
): Promise<string> {
  const ESV_API_KEY = process.env.ESV_API_KEY;
  if (!ESV_API_KEY) {
    throw new Error('ESV_API_KEY is not defined in environment variables.');
  }

  const query = encodeURIComponent(`${bookName} ${chapter}:${verseNumber}`);
  const url = `https://api.esv.org/v3/passage/text/?q=${query}&include-verse-numbers=false&include-headings=false&include-footnotes=false&include-passage-references=false&include-short-copyright=false&include-first-verse-numbers=false`;

  console.log(`Fetching verse ${bookName} ${chapter}:${verseNumber} from ESV API...`);

  const response = await fetch(url, {
    headers: {
      Authorization: `Token ${ESV_API_KEY}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch verse from ESV API: ${response.status} ${response.statusText}`);
  }

  const result = (await response.json()) as { passages: string[] };

  if (!result.passages || result.passages.length === 0) {
    throw new Error(`No passages returned from ESV API for ${bookName} ${chapter}:${verseNumber}`);
  }

  return result.passages[0].trim();
}

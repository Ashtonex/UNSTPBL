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

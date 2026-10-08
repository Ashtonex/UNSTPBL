// Psalm 119 is split into 22 stanzas named after Hebrew letters; some sources
// prepend the stanza name to the first verse of each ("Nun\n\n  Your word is...").
const PSALM_119_STANZA_HEADING =
  /^(Aleph|Beth|Gimel|Daleth|He|Waw|Zayin|Heth|Teth|Yodh|Kaph|Lamedh|Mem|Nun|Samekh|Ayin|Pe|Tsadhe|Qoph|Resh|Shin|Taw)[ \t]*\r?\n/;

/**
 * Turns scripture text from the Bible APIs into clean reading text.
 *
 * - `{art}`            words the KJV translators supplied -> kept, braces removed
 * - `{Heb. ...: ...}`  margin notes (they contain a colon) -> removed entirely
 * - Psalm 119 stanza headings, hard line breaks and indentation -> removed
 *
 * Safe to apply more than once (idempotent).
 */
export function cleanVerseText(raw: string): string {
  return raw
    .replace(PSALM_119_STANZA_HEADING, '')
    .replace(/\{[^{}]*:[^{}]*\}/g, '')
    .replace(/\{([^{}]*)\}/g, '$1')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();
}

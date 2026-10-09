/**
 * SMS length and encoding.
 *
 * You are billed per *segment*, not per message. A plain-text (GSM 7-bit) message
 * holds 160 characters in one segment, or 153 per segment once it spans several.
 * A single character outside that alphabet (a curly quote, an emoji) switches the
 * whole message to UCS-2, where a segment holds only 70 (67 when split). Verses are
 * full of curly quotes and dashes, so unnormalised they cost two to three times more.
 */

const GSM_BASIC =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
// Each of these takes two septets (an escape plus the character).
const GSM_EXTENDED = '^{}\\[~]|€\f';

const GSM_BASIC_SET = new Set(GSM_BASIC);
const GSM_EXTENDED_SET = new Set(GSM_EXTENDED);

// Built from code points (not written out as literals) because several of these
// characters are invisible or look identical to plain ones in an editor.
const anyOf = (...codePoints: number[]) =>
  new RegExp(`[${codePoints.map((code) => String.fromCodePoint(code)).join('')}]`, 'g');

const REPLACEMENTS: Array<[RegExp, string]> = [
  [anyOf(0x2018, 0x2019, 0x201a, 0x2032), "'"], // curly single quotes, prime
  [anyOf(0x201c, 0x201d, 0x201e, 0x2033), '"'], // curly double quotes, double prime
  [anyOf(0x2013, 0x2014, 0x2212), '-'], // en dash, em dash, minus sign
  [anyOf(0x2026), '...'], // ellipsis
  [anyOf(0x00a0, 0x2007, 0x202f), ' '], // non-breaking spaces
  [anyOf(0x200b, 0x200c, 0x200d, 0xfeff), ''], // zero-width characters
];

/** Swaps typographic characters for their plain equivalents so the message stays in cheap GSM encoding. */
export function toSmsFriendly(text: string): string {
  let result = text.normalize('NFC');
  for (const [pattern, replacement] of REPLACEMENTS) result = result.replace(pattern, replacement);
  return result.replace(/[ \t]+/g, ' ').trim();
}

export interface SmsAnalysis {
  encoding: 'gsm7' | 'ucs2';
  /** Septets for GSM-7, UTF-16 code units for UCS-2. */
  length: number;
  segments: number;
}

export function analyzeSms(text: string): SmsAnalysis {
  let septets = 0;
  let isGsm = true;
  for (const char of text) {
    if (GSM_BASIC_SET.has(char)) septets += 1;
    else if (GSM_EXTENDED_SET.has(char)) septets += 2;
    else {
      isGsm = false;
      break;
    }
  }

  if (isGsm) {
    const segments = septets === 0 ? 0 : septets <= 160 ? 1 : Math.ceil(septets / 153);
    return { encoding: 'gsm7', length: septets, segments };
  }

  const units = text.length;
  return { encoding: 'ucs2', length: units, segments: units === 0 ? 0 : units <= 70 ? 1 : Math.ceil(units / 67) };
}

/** Largest message (in characters) that still fits the given number of GSM-7 segments. */
export function gsmCapacity(segments: number): number {
  return segments <= 1 ? 160 : 153 * segments;
}

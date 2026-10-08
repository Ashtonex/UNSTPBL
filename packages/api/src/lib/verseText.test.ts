import { describe, expect, it } from 'vitest';
// Lives with the API tests because the shared package has no test runner of its own.
import { cleanVerseText } from '@unstpbl/shared';

describe('cleanVerseText', () => {
  it('keeps KJV supplied words but drops their braces', () => {
    expect(cleanVerseText('Happy {art} thou, O Israel: who {is} like unto thee')).toBe(
      'Happy art thou, O Israel: who is like unto thee',
    );
  });

  it('removes margin notes entirely, including the space before punctuation', () => {
    expect(
      cleanVerseText('And Leah said, Happy am I: and she called his name Asher. {Happy...: Heb. In my happiness} {Asher: that is, Happy}'),
    ).toBe('And Leah said, Happy am I: and she called his name Asher.');
    expect(cleanVerseText('thou shalt tread upon their high places {found...: or, subdued}.')).toBe(
      'thou shalt tread upon their high places.',
    );
  });

  it('strips the Psalm 119 stanza heading and flattens ESV poetry line breaks', () => {
    expect(cleanVerseText('Nun\n\n    Your word is a lamp to my feet\n        and a light to my path.')).toBe(
      'Your word is a lamp to my feet and a light to my path.',
    );
  });

  it('does not eat ordinary words that merely match a stanza name', () => {
    // A heading is the letter name alone on its own line; inline mentions are kept.
    expect(cleanVerseText('Nun is not a heading here')).toBe('Nun is not a heading here');
    expect(cleanVerseText('Pe was the name of a letter, said the teacher')).toBe(
      'Pe was the name of a letter, said the teacher',
    );
  });

  it('leaves clean text alone and is idempotent', () => {
    const clean = 'Thy word is a lamp unto my feet, and a light unto my path.';
    expect(cleanVerseText(clean)).toBe(clean);
    const once = cleanVerseText('Happy {art} thou {x: note}\n\n  indeed');
    expect(cleanVerseText(once)).toBe(once);
  });

  it('handles empty input', () => {
    expect(cleanVerseText('')).toBe('');
    expect(cleanVerseText('   \n ')).toBe('');
  });
});

import { describe, expect, it } from 'vitest';

import { splitInlineCode } from './inline-code';

describe('splitInlineCode', () => {
  it('splits backtick spans out of prose, in order', () => {
    expect(splitInlineCode('Accepts hex, `oklch()`, or `oklab()`.')).toEqual([
      { code: false, text: 'Accepts hex, ' },
      { code: true, text: 'oklch()' },
      { code: false, text: ', or ' },
      { code: true, text: 'oklab()' },
      { code: false, text: '.' },
    ]);
  });

  it('returns plain text as one prose segment', () => {
    expect(splitInlineCode('Overall brightness.')).toEqual([
      { code: false, text: 'Overall brightness.' },
    ]);
  });

  it('keeps an unclosed backtick as prose', () => {
    expect(splitInlineCode('a ` b')).toEqual([{ code: false, text: 'a ` b' }]);
  });
});

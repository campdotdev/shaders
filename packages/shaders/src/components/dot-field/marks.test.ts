import { describe, expect, it } from 'vitest';

import { resolveMarkEntries } from './marks.js';

// The shape prop is one mark or a list of them, and the shader wants one
// form: an ordered entry list plus a string key the material effect can
// depend on, because an array literal is a new reference every render.
describe('resolveMarkEntries', () => {
  it('wraps a single mark as a one-entry list keyed by its name', () => {
    expect(resolveMarkEntries('cross')).toEqual({ entries: ['cross'], key: 'cross' });
  });

  it('keeps an array in order with its repeats, which is how a mark is weighted', () => {
    // `as const` is the caller's readonly tuple; it must pass with no cast.
    const shape = ['circle', 'cross', 'cross'] as const;

    expect(resolveMarkEntries(shape)).toEqual({
      entries: ['circle', 'cross', 'cross'],
      key: 'circle|cross|cross',
    });
  });

  it('gives a single mark and its one-entry array the same key, so neither rebuilds the other', () => {
    expect(resolveMarkEntries(['circle']).key).toBe(resolveMarkEntries('circle').key);
  });

  it('turns an empty array into no entries, which the shader draws as nothing', () => {
    expect(resolveMarkEntries([])).toEqual({ entries: [], key: '' });
  });
});

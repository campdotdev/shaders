import { describe, expect, it } from 'vitest';

import { resolveMarkEntries } from './marks.js';

const TRIANGLE = '<svg viewBox="0 0 24 24"><path d="M12 2 22 22H2z"/></svg>';
const SQUARE = '<svg viewBox="0 0 10 10"><rect width="10" height="10"/></svg>';

// The shape prop is one mark or a list of them, and the shader wants one
// form: an ordered entry list plus a string key the material effect can
// depend on, because an array literal is a new reference every render.
describe('resolveMarkEntries', () => {
  it('wraps a single mark as a one-entry list', () => {
    expect(resolveMarkEntries('cross').entries).toEqual(['cross']);
  });

  it('keeps an array in order with its repeats, which is how a mark is weighted', () => {
    // `as const` is the caller's readonly tuple; it must pass with no cast.
    const shape = ['circle', 'cross', 'cross'] as const;

    expect(resolveMarkEntries(shape).entries).toEqual(['circle', 'cross', 'cross']);
  });

  it('keeps a custom mark as its object, so the shader can tell it from a name', () => {
    expect(resolveMarkEntries({ svg: TRIANGLE }).entries).toEqual([{ svg: TRIANGLE }]);
  });

  it('gives a single mark and its one-entry array the same key, so neither rebuilds the other', () => {
    expect(resolveMarkEntries(['circle']).key).toBe(resolveMarkEntries('circle').key);
    expect(resolveMarkEntries([{ svg: TRIANGLE }]).key).toBe(
      resolveMarkEntries({ svg: TRIANGLE }).key,
    );
  });

  it('gives two objects with the same markup the same key, because the object identity is not the mark', () => {
    expect(resolveMarkEntries({ svg: TRIANGLE }).key).toBe(
      resolveMarkEntries({ svg: TRIANGLE }).key,
    );
  });

  it('changes the key when the markup, the order, or a repeat changes', () => {
    const triangle = resolveMarkEntries({ svg: TRIANGLE }).key;
    const square = resolveMarkEntries({ svg: SQUARE }).key;
    const mixed = resolveMarkEntries(['circle', { svg: TRIANGLE }]).key;
    const reordered = resolveMarkEntries([{ svg: TRIANGLE }, 'circle']).key;
    const repeated = resolveMarkEntries(['circle', { svg: TRIANGLE }, { svg: TRIANGLE }]).key;

    expect(new Set([triangle, square, mixed, reordered, repeated]).size).toBe(5);
  });

  it('turns an empty array into no entries, which the shader draws as nothing', () => {
    expect(resolveMarkEntries([]).entries).toEqual([]);
  });
});

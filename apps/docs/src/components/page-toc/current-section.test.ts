import { describe, expect, it } from 'vitest';

import { pickCurrentSection } from './current-section';

// Three sections, as on every component page: the component itself, Usage,
// and API Reference. Tops are px from the top of the viewport.
const base = { chosenIndex: -1, viewportHeight: 1100, scrollTop: 500, scrollHeight: 3000 };

describe('pickCurrentSection', () => {
  it('lights the last section at the bottom of a short page in a tall window', () => {
    // Measured on /components/grain at 1440x1100 (SHA-131): Usage's title is
    // still on screen at the bottom, and API Reference's title sits below the
    // reading line. The reader can scroll no further, so API Reference it is.
    const result = pickCurrentSection({
      ...base,
      tops: [-548, 106, 618],
      scrollTop: 820,
      scrollHeight: 1920,
    });

    expect(result).toEqual({ index: 2, held: false });
  });

  it('treats a fractional scroll position within a pixel of the end as the bottom', () => {
    const result = pickCurrentSection({
      ...base,
      tops: [-548, 106, 618],
      scrollTop: 819.5,
      scrollHeight: 1920,
    });

    expect(result.index).toBe(2);
  });

  it('does not count a page that fits the window as being at its bottom', () => {
    // Nothing to scroll, so the reading line decides: only the first title
    // has passed it.
    const result = pickCurrentSection({
      ...base,
      tops: [100, 600, 900],
      scrollTop: 0,
      scrollHeight: 1000,
    });

    expect(result).toEqual({ index: 0, held: false });
  });

  it('picks the last section whose title has passed the reading line mid-page', () => {
    const result = pickCurrentSection({ ...base, tops: [-500, 100, 700] });

    expect(result).toEqual({ index: 1, held: false });
  });

  it('falls back to the first section before any title reaches the line', () => {
    const result = pickCurrentSection({ ...base, tops: [300, 900, 1500], scrollTop: 0 });

    expect(result).toEqual({ index: 0, held: false });
  });

  it('holds the chosen section while its title is on screen, even at the bottom', () => {
    // A menu jump to Usage that landed at the bottom of a short page: the
    // reader said Usage, and its title is in view, so Usage stays lit.
    const result = pickCurrentSection({
      ...base,
      chosenIndex: 1,
      tops: [-548, 106, 618],
      scrollTop: 820,
      scrollHeight: 1920,
    });

    expect(result).toEqual({ index: 1, held: true });
  });

  it('releases the chosen section once its title leaves the screen', () => {
    const result = pickCurrentSection({ ...base, chosenIndex: 1, tops: [-900, -50, 150] });

    expect(result).toEqual({ index: 2, held: false });
  });
});

import { describe, expect, it } from 'vitest';

import { cardRevealAt, itemRevealAt } from './reveal-scrub';

// The heading and the seven cards.
const COUNT = 8;

describe('itemRevealAt', () => {
  it('starts every item hidden', () => {
    for (let index = 0; index < COUNT; index += 1) expect(itemRevealAt(0, index, COUNT)).toBe(0);
  });

  it('lands the last card exactly as the reveal range ends', () => {
    expect(itemRevealAt(0.99, COUNT - 1, COUNT)).toBeLessThan(1);
    expect(itemRevealAt(1, COUNT - 1, COUNT)).toBe(1);
  });

  // Halfway, the heading has just landed and the last card is about to
  // start, so every item stands at a different point.
  it('runs in reading order, the heading first', () => {
    const at = (index: number) => itemRevealAt(0.5, index, COUNT);

    for (let index = 1; index < COUNT; index += 1) expect(at(index)).toBeLessThan(at(index - 1));
  });
});

describe('cardRevealAt', () => {
  it('starts a card one whole height down, behind its own resting bottom edge', () => {
    const card = cardRevealAt(0, 240);

    expect(card.y).toBe(240);
    expect(card.mask).toMatch(/rgb\(0 0 0 \/ 0\) 0px\)$/);
  });

  it('rests a card in place with no mask', () => {
    expect(cardRevealAt(1, 240)).toEqual({ y: 0, mask: 'none' });
  });

  it('scales the fade with the card, in the panel fade proportion of 160 to 288', () => {
    const card = cardRevealAt(0.5, 288);

    // Halfway, the card is 144px down, so the resting edge sits 144px into
    // it and the fade, 160px for a 288px card, starts 16px above its top.
    expect(card.mask).toMatch(/^linear-gradient\(to bottom, #000 -16px/);
  });
});

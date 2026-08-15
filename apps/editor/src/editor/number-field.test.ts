import { describe, expect, it } from 'vitest';

import {
  decimalsOf,
  formatValue,
  parseTyped,
  SCRUB_SWEEP_PX,
  snapToStep,
  valueFromScrub,
} from './number-field';

// The dial NumberField stands in for most often: a 0.5-10 range on 0.1 steps.
const scale = { min: 0.5, max: 10, step: 0.1 };
// A normalized 0-1 dial, the shape every ramp stop position takes.
const unit = { min: 0, max: 1, step: 0.01 };

describe('snapToStep', () => {
  it('lands on a step boundary measured from min, not from zero', () => {
    expect(snapToStep(0.63, scale)).toBe(0.6);
    expect(snapToStep(0.66, scale)).toBe(0.7);
  });

  it('clears binary float dust', () => {
    // 0.5 + 3 * 0.1 is 0.8000000000000001 in IEEE 754; a dial that reads
    // "0.80" must not serialize as that.
    expect(snapToStep(0.79, scale)).toBe(0.8);
    expect(snapToStep(0.07, unit)).toBe(0.07);
  });

  it('clamps to both ends', () => {
    expect(snapToStep(-5, scale)).toBe(0.5);
    expect(snapToStep(999, scale)).toBe(10);
    expect(snapToStep(-0.2, unit)).toBe(0);
    expect(snapToStep(4, unit)).toBe(1);
  });
});

describe('valueFromScrub', () => {
  it('traverses the whole range over one sweep', () => {
    expect(valueFromScrub(scale.min, SCRUB_SWEEP_PX, scale)).toBe(scale.max);
    expect(valueFromScrub(scale.max, -SCRUB_SWEEP_PX, scale)).toBe(scale.min);
  });

  it('moves proportionally for a partial drag', () => {
    // Half a sweep from the bottom covers half the range: 0.5 + 4.75 = 5.25,
    // snapped to the nearest 0.1 boundary above min.
    expect(valueFromScrub(scale.min, SCRUB_SWEEP_PX / 2, scale)).toBeCloseTo(5.3, 5);
  });

  it('is symmetric — dragging back returns the starting value', () => {
    const out = valueFromScrub(3, 40, scale);

    expect(valueFromScrub(out, -40, scale)).toBe(3);
  });

  it('stays put for a zero-distance drag', () => {
    expect(valueFromScrub(3, 0, scale)).toBe(3);
  });

  it('never escapes the range no matter how far the pointer travels', () => {
    expect(valueFromScrub(3, 10_000, scale)).toBe(scale.max);
    expect(valueFromScrub(3, -10_000, scale)).toBe(scale.min);
  });
});

describe('parseTyped', () => {
  it('accepts a plain number and snaps it', () => {
    expect(parseTyped('4.23', scale)).toBe(4.2);
  });

  it('tolerates surrounding whitespace', () => {
    expect(parseTyped('  7 ', scale)).toBe(7);
  });

  it('clamps rather than rejecting an out-of-range number', () => {
    expect(parseTyped('900', scale)).toBe(10);
    expect(parseTyped('-3', scale)).toBe(0.5);
  });

  it('returns null for anything that is not a number, so the caller can revert', () => {
    expect(parseTyped('', scale)).toBeNull();
    expect(parseTyped('   ', scale)).toBeNull();
    expect(parseTyped('abc', scale)).toBeNull();
    expect(parseTyped('1.2.3', scale)).toBeNull();
  });
});

describe('formatValue', () => {
  // Matches what the old slider readout showed, so swapping the control in
  // doesn't silently change how every dial reads.
  it('shows two decimals for fractional steps and none for whole ones', () => {
    expect(formatValue(3, scale)).toBe('3.00');
    expect(formatValue(0.5, unit)).toBe('0.50');
    expect(formatValue(45, { min: 0, max: 360, step: 1 })).toBe('45');
  });
});

describe('decimalsOf', () => {
  it('counts a step size decimal places', () => {
    expect(decimalsOf(1)).toBe(0);
    expect(decimalsOf(0.1)).toBe(1);
    expect(decimalsOf(0.01)).toBe(2);
  });
});

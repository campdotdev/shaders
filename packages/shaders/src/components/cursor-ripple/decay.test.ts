import { describe, expect, it } from 'vitest';

import { dampingForDecay, lifetimeForDecay } from './decay.js';

// `decay` is the everyday dial: 0 is a pool that keeps its rings for
// seconds, 1 is water that goes still almost at once. The wave field wants
// the fraction of height that survives each substep, so this maps one onto
// the other through a ring's lifetime.
describe('lifetimeForDecay', () => {
  it('runs from five seconds at 0 to a twentieth of a second at 1', () => {
    expect(lifetimeForDecay(0)).toBeCloseTo(5, 6);
    expect(lifetimeForDecay(1)).toBeCloseTo(0.05, 6);
  });

  it('is log-spaced, so the middle of the dial is the geometric middle', () => {
    expect(lifetimeForDecay(0.5)).toBeCloseTo(0.5, 6);
  });

  it('clamps out-of-range dials to the ends', () => {
    expect(lifetimeForDecay(-1)).toBe(lifetimeForDecay(0));
    expect(lifetimeForDecay(4)).toBe(lifetimeForDecay(1));
  });
});

describe('dampingForDecay', () => {
  it('keeps more per substep the lower the dial', () => {
    expect(dampingForDecay(0)).toBeGreaterThan(dampingForDecay(0.5));
    expect(dampingForDecay(0.5)).toBeGreaterThan(dampingForDecay(1));
  });

  // A 0.14 s lifetime, the feel found at the rig gate, sits near 0.78 on
  // the dial, leaving headroom above the working default of 0.75.
  it('puts a 0.14 s lifetime near 0.78 on the dial', () => {
    expect(lifetimeForDecay(0.78)).toBeCloseTo(0.14, 1);
  });
});

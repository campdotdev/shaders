// Exercises CursorTrail's brush growth through the share it returns.
import { expect, it } from 'vitest';

import type { PushStroke } from '../../engine.js';
import { createGrowth, type Growth } from './grow.js';

const FRAME = 1 / 60;

// One frame's stroke at `speed` canvas heights per second.
function stroke(speed: number): PushStroke {
  return { from: [0.2, 0.5], to: [0.2 + speed * FRAME, 0.5], presence: 1 };
}

function run(growth: Growth, seconds: number, next: PushStroke | null, disabled = false) {
  for (let frame = 0; frame < Math.round(seconds / FRAME); frame += 1)
    growth.step(next, FRAME, 1, disabled);

  return growth.share;
}

it('grows with a fast pointer and settles to exactly 0 once it stops', () => {
  const growth = createGrowth();

  expect(run(growth, 0.5, stroke(3))).toBeGreaterThan(0.8);
  expect(run(growth, 0.5, null)).toBeGreaterThan(0);
  expect(run(growth, 1.5, null)).toBe(0);
});

it('grows less for a slower pointer', () => {
  const slow = run(createGrowth(), 0.5, stroke(0.5));
  const fast = run(createGrowth(), 0.5, stroke(3));

  expect(slow).toBeGreaterThan(0);
  expect(slow).toBeLessThan(fast);
});

it('holds its size when no time passes', () => {
  const growth = createGrowth();
  const grown = run(growth, 0.2, stroke(3));

  expect(growth.step(null, 0, 1, false)).toBe(grown);
});

it('settles while disabled, whatever the pointer does', () => {
  const growth = createGrowth();

  run(growth, 0.5, stroke(3));
  expect(run(growth, 2, stroke(3), true)).toBe(0);
});

it('drops to the base size at once on reset', () => {
  const growth = createGrowth();

  run(growth, 0.5, stroke(3));
  growth.reset();
  expect(growth.share).toBe(0);
});

it('ignores a stroke whose brush is off the canvas', () => {
  const growth = createGrowth();

  expect(run(growth, 0.5, { ...stroke(3), presence: 0 })).toBe(0);
});

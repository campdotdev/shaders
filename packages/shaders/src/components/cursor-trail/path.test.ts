// Exercises CursorTrail's path through its packed output, the points the
// shader draws. The dev probe checks the actual GPU image.
import { expect, it } from 'vitest';

import type { PushStroke, Vector2 } from '../../engine.js';
import { createTrailPath, MAX_POINTS, type PathStep, type TrailPath } from './path.js';

const FRAME = 1 / 60;
const RADIUS = 0.1;

// ---- Driving and reading the path
function step(path: TrailPath, overrides: Partial<PathStep>) {
  path.step({
    delta: FRAME,
    stroke: null,
    rest: null,
    radius: RADIUS,
    decay: 2,
    aspect: 1,
    disabled: false,
    ...overrides,
  });
}

// Moves the pointer right along y = 0.5 at `speed` canvas heights per
// second for `seconds`, one stroke per frame, and returns where it ends.
function moveRight(path: TrailPath, seconds: number, speed: number, decay = 2): Vector2 {
  let x = 0.1;

  for (let frame = 0; frame < Math.round(seconds / FRAME); frame += 1) {
    const stroke: PushStroke = { from: [x, 0.5], to: [x + speed * FRAME, 0.5], presence: 1 };

    x += speed * FRAME;
    step(path, { stroke, decay });
  }

  return [x, 0.5];
}

// The packed points, as [x, y, width, heat] each.
function packed(path: TrailPath) {
  const out = new Float32Array(MAX_POINTS * 4);
  const count = path.pack(out);

  return Array.from({ length: count }, (_, at) => Array.from(out.subarray(at * 4, at * 4 + 4)));
}

// How far the drawn shape reaches back from its head, in canvas heights.
function tailLength(path: TrailPath) {
  const points = packed(path);
  let length = 0;

  for (let at = 2; at < points.length; at += 1) {
    const [x0 = 0, y0 = 0] = points[at - 1] ?? [];
    const [x1 = 0, y1 = 0] = points[at] ?? [];

    length += Math.hypot(x1 - x0, y1 - y0);
  }

  return length;
}

// ---- Behavior
it('trails as far as the pointer travels in decay seconds at a steady speed', () => {
  const path = createTrailPath();

  moveRight(path, 6, 0.2, 1);

  // Within 5%: drawing in once a frame settles a little short of the ideal.
  expect(Math.abs(tailLength(path) - 0.2)).toBeLessThan(0.01);
});

it('starts drawing the tail in as soon as the pointer stops, even after a short stroke', () => {
  const path = createTrailPath();
  const rest = moveRight(path, 0.5, 1);
  const atStop = tailLength(path);

  for (let frame = 0; frame < 6; frame += 1) step(path, { rest });

  expect(tailLength(path)).toBeLessThan(atStop * 0.97);
});

it('draws the tail all the way into a held head in decay seconds', () => {
  const path = createTrailPath();
  const rest = moveRight(path, 0.5, 1);

  for (let frame = 0; frame < Math.round(1.9 / FRAME); frame += 1) step(path, { rest });
  expect(tailLength(path)).toBeGreaterThan(0);

  for (let frame = 0; frame < Math.round(0.2 / FRAME); frame += 1) step(path, { rest });
  expect(tailLength(path)).toBe(0);
  // The head is still there, whole: full width and heat.
  const [, width, heat] = packed(path)[1]?.slice(1) ?? [];

  expect(width).toBeCloseTo(RADIUS, 5);
  expect(heat).toBe(1);
});

it('leaves nothing once decay passes without hold', () => {
  const path = createTrailPath();

  moveRight(path, 0.5, 1);
  for (let frame = 0; frame < Math.round(2.1 / FRAME); frame += 1) step(path, {});

  expect(packed(path)).toHaveLength(0);
});

it('draws the head as a whole disc while the tail is nearly gone', () => {
  const path = createTrailPath();
  const rest = moveRight(path, 0.5, 1);

  // Just short of decay, the tail is a sliver behind the head.
  for (let frame = 0; frame < Math.round(1.98 / FRAME); frame += 1) step(path, { rest });
  const [, head, again] = packed(path);

  expect(head).toEqual(again);
  expect(head?.[2]).toBeCloseTo(RADIUS, 5);
});

it('thins the tail with the head when the brush shrinks back', () => {
  const path = createTrailPath();
  let x = 0.1;

  // A fast move with a grown brush, then a rest back at the base radius.
  for (let frame = 0; frame < 30; frame += 1) {
    const stroke: PushStroke = { from: [x, 0.5], to: [x + FRAME, 0.5], presence: 1 };

    x += FRAME;
    step(path, { stroke, radius: RADIUS * 2 });
  }
  step(path, { rest: [x, 0.5] });

  const widest = Math.max(...packed(path).map(([, , width = 0]) => width));

  expect(tailLength(path)).toBeGreaterThan(0);
  expect(widest).toBeCloseTo(RADIUS, 5);
});

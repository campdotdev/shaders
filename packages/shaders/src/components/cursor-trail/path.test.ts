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
    smoothing: 0,
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

// The sharpest turn between neighboring packed segments past the head, in
// degrees.
function sharpestTurn(path: TrailPath) {
  const points = packed(path).slice(2);
  let sharpest = 0;

  for (let at = 2; at < points.length; at += 1) {
    const [x0 = 0, y0 = 0] = points[at - 2] ?? [];
    const [x1 = 0, y1 = 0] = points[at - 1] ?? [];
    const [x2 = 0, y2 = 0] = points[at] ?? [];
    const turn = Math.abs(Math.atan2(y2 - y1, x2 - x1) - Math.atan2(y1 - y0, x1 - x0));

    sharpest = Math.max(sharpest, Math.min(turn, Math.PI * 2 - turn));
  }

  return (sharpest * 180) / Math.PI;
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

it('starts drawing the tail in as soon as the pointer stops after small moves and a flick', () => {
  const path = createTrailPath();
  const [x, y] = moveRight(path, 0.1, 1);
  let from: Vector2 = [x, y];

  // Forty moves between the head and just behind it, each closer than the
  // points' spacing, so each slides the head instead of adding a point.
  for (let frame = 0; frame < 40; frame += 1) {
    const to: Vector2 = [frame % 2 ? x : x - 0.003, y];

    step(path, { stroke: { from, to, presence: 1 } });
    from = to;
  }
  const rest: Vector2 = [from[0] + 0.05, y];

  step(path, { stroke: { from, to: rest, presence: 1 } });
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

it('draws a resting tail in by a new decay when decay changes', () => {
  const path = createTrailPath();
  const rest = moveRight(path, 0.5, 1);

  for (let frame = 0; frame < 6; frame += 1) step(path, { rest });
  for (let frame = 0; frame < Math.round(0.15 / FRAME); frame += 1) {
    step(path, { rest, decay: 0.1 });
  }

  expect(tailLength(path)).toBe(0);
});

it('draws nothing between two resting spots', () => {
  const path = createTrailPath();

  // Rest at one spot, leave so it starts to fade, then rest at another.
  for (let frame = 0; frame < 6; frame += 1) step(path, { rest: [0.2, 0.5] });
  for (let frame = 0; frame < 6; frame += 1) step(path, {});
  for (let frame = 0; frame < 6; frame += 1) step(path, { rest: [0.8, 0.5] });
  const points = packed(path);

  // Both spots still show.
  expect(points.filter(([, , width = 0]) => width > 0).length).toBeGreaterThan(0);
  for (let at = 1; at < points.length; at += 1) {
    const [x0, y0, width0 = 0] = points[at - 1] ?? [];
    const [x1, y1, width1 = 0] = points[at] ?? [];

    // A segment that spans any distance is part of a tail, and there is none.
    if (x0 !== x1 || y0 !== y1) expect([width0, width1]).toEqual([0, 0]);
  }
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

it('rounds the corner between one move and the next', () => {
  const path = createTrailPath();
  // A fast flick: a quarter turn in four long moves, about 0.08 apart.
  const corners: Vector2[] = [
    [0.3, 0.5],
    [0.38, 0.52],
    [0.45, 0.57],
    [0.5, 0.64],
    [0.52, 0.72],
  ];

  for (let at = 1; at < corners.length; at += 1) {
    const from = corners[at - 1];
    const to = corners[at];

    if (from && to) step(path, { stroke: { from, to, presence: 1 } });
  }

  // The raw moves turn about 22 degrees at each corner.
  expect(sharpestTurn(path)).toBeLessThan(8);
});

it('smooths a shaky path behind the head without moving the head', () => {
  const path = createTrailPath();
  let from: Vector2 = [0.1, 0.5];

  // Right along y = 0.5, wobbling 0.01 up and down every move.
  for (let frame = 1; frame <= 40; frame += 1) {
    const to: Vector2 = [0.1 + frame * 0.01, 0.5 + (frame % 2 ? 0.01 : -0.01)];

    step(path, { stroke: { from, to, presence: 1 }, smoothing: 0.05 });
    from = to;
  }
  const points = packed(path);
  const [, head] = points;
  const [tailX = 0] = points.at(-1) ?? [];
  // Beyond the smoothing's reach from either end, the wobble is mostly gone.
  const settled = points.filter(([x = 0]) => x < from[0] - 0.05 && x > tailX + 0.05);

  expect(head?.slice(0, 2)).toEqual([from[0], 1 - from[1]].map(Math.fround));
  expect(settled.length).toBeGreaterThan(0);
  for (const [, y = 0] of settled) expect(Math.abs(y - 0.5)).toBeLessThan(0.002);
});

it('spaces the newest path by the pieces that fit, not every piece', () => {
  const path = createTrailPath();

  // Forty short flicks, each its own piece, all still fading.
  for (let flick = 0; flick < 40; flick += 1) {
    const y = 0.05 + flick * 0.02;

    step(path, { stroke: { from: [0.1, y], to: [0.15, y], presence: 1 }, decay: 10 });
    for (let frame = 0; frame < 4; frame += 1) step(path, { decay: 10 });
  }
  moveRight(path, 0.5, 1, 10);
  const points = packed(path);
  // The newest piece runs from its head at 1 to its tail, the first point
  // after the head copies with no width.
  const tail = points.findIndex(([, , width = 0], at) => at > 2 && width === 0);

  expect(points.length).toBeLessThanOrEqual(MAX_POINTS);
  expect(tail).toBeGreaterThan(6);
});

it('fits a long path into the budget, keeping both ends', () => {
  const path = createTrailPath();
  const end = moveRight(path, 4, 0.6, 3);
  const points = packed(path);
  const [, head] = points;
  const tail = points.at(-1);

  expect(points.length).toBeLessThanOrEqual(MAX_POINTS);
  expect(head?.[0]).toBeCloseTo(end[0], 5);
  // The tail comes to a point.
  expect(tail?.[2]).toBe(0);
  // Still growing toward 1.8, 0.6 times decay, after 4 seconds.
  expect(tailLength(path)).toBeGreaterThan(1.2);
});

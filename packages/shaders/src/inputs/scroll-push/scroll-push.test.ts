import { describe, expect, it, vi } from 'vitest';

import {
  type CanvasRect,
  createPushTracker,
  FLING_SETTLE_FRAMES,
  RESTING_WOBBLE_PX,
  type TouchPoint,
} from './scroll-push.js';

// A finger with a fixed id at a client point, in CSS pixels.
const finger = (x: number, y: number, id = 1): TouchPoint => ({ id, x, y });

// The canvas at a client position, 300 CSS pixels square, so a 30 pixel
// move is a tenth of the canvas.
const canvasAt = (left: number, top: number): CanvasRect => ({
  left,
  top,
  width: 300,
  height: 300,
});

// A stroke in canvas units, compared to nine decimal places, since the
// expected values are written as fractions of the canvas.
const stroke = (from: [number, number], to: [number, number], presence = 1) => ({
  from: from.map((value) => expect.closeTo(value, 9)),
  to: to.map((value) => expect.closeTo(value, 9)),
  presence,
});

const setUp = () => createPushTracker();

describe('createPushTracker', () => {
  it('strokes the water under the finger, along the way the page carried it', () => {
    const push = setUp();
    const touch = finger(100, 200);

    push.touchStart({ touches: [touch], changed: [touch] }, canvasAt(0, 100));
    expect(push.getPhase()).toBe('down');
    // The page scrolls up 30 pixels, and the finger and the canvas move together.
    expect(push.frame(canvasAt(0, 70))).toEqual(stroke([1 / 3, 1 / 3 + 0.1], [1 / 3, 1 / 3]));
  });

  it('strokes nothing while the finger rests and the page stays put', () => {
    const push = setUp();
    const touch = finger(100, 200);

    push.touchStart({ touches: [touch], changed: [touch] }, canvasAt(0, 100));
    expect(push.frame(canvasAt(0, 100))).toBeUndefined();
    expect(push.frame(canvasAt(0, 100))).toBeUndefined();
  });

  it('strokes along a drag across a canvas that does not scroll', () => {
    const push = setUp();
    const touch = finger(100, 200);
    const dragged = finger(130, 200);

    push.touchStart({ touches: [touch], changed: [touch] }, canvasAt(0, 100));
    push.touchMove({ touches: [dragged], changed: [dragged] }, canvasAt(0, 100));
    expect(push.frame(canvasAt(0, 100))).toEqual(stroke([1 / 3, 1 / 3], [1 / 3 + 0.1, 1 / 3]));
  });

  it('keeps pushing at the last brush point while a fling carries the canvas', () => {
    const push = setUp();
    const touch = finger(100, 200);

    push.touchStart({ touches: [touch], changed: [touch] }, canvasAt(0, 100));
    push.touchEnd({ touches: [], changed: [touch] });
    expect(push.getPhase()).toBe('fling');
    expect(push.frame(canvasAt(0, 70))).toEqual(stroke([1 / 3, 1 / 3 + 0.1], [1 / 3, 1 / 3]));
  });

  it('stops a fling once the canvas has held still for the settle frames', () => {
    const push = setUp();
    const touch = finger(100, 200);

    push.touchStart({ touches: [touch], changed: [touch] }, canvasAt(0, 100));
    push.touchEnd({ touches: [], changed: [touch] });
    for (let frame = 1; frame < FLING_SETTLE_FRAMES; frame += 1) push.frame(canvasAt(0, 100));
    expect(push.getPhase()).toBe('fling');
    push.frame(canvasAt(0, 100));
    expect(push.getPhase()).toBe('idle');
    expect(push.frame(canvasAt(0, 70))).toBeUndefined();
  });

  it('pushes nothing while two fingers are down, until every finger lifts', () => {
    const push = setUp();
    const first = finger(100, 200, 1);
    const second = finger(200, 250, 2);
    const next = finger(100, 200, 3);

    push.touchStart({ touches: [first], changed: [first] }, canvasAt(0, 100));
    push.touchStart({ touches: [first, second], changed: [second] }, canvasAt(0, 100));
    expect(push.getPhase()).toBe('pinch');
    expect(push.frame(canvasAt(0, 70))).toBeUndefined();
    push.touchEnd({ touches: [second], changed: [first] });
    expect(push.getPhase()).toBe('pinch');
    expect(push.frame(canvasAt(0, 40))).toBeUndefined();
    push.touchEnd({ touches: [], changed: [second] });
    expect(push.getPhase()).toBe('idle');

    push.touchStart({ touches: [next], changed: [next] }, canvasAt(0, 100));
    expect(push.frame(canvasAt(0, 70))).toEqual(stroke([1 / 3, 1 / 3 + 0.1], [1 / 3, 1 / 3]));
  });

  it('starts fresh when a finger lands during a fling, with no stroke joining the two', () => {
    const push = setUp();
    const first = finger(100, 200, 1);
    const second = finger(250, 150, 2);

    push.touchStart({ touches: [first], changed: [first] }, canvasAt(0, 100));
    push.touchEnd({ touches: [], changed: [first] });
    push.frame(canvasAt(0, 70));
    push.touchStart({ touches: [second], changed: [second] }, canvasAt(0, 70));
    expect(push.getPhase()).toBe('down');
    expect(push.frame(canvasAt(0, 70))).toBeUndefined();
  });

  it('treats a second finger off the canvas as a pinch, seen on the next move', () => {
    const push = setUp();
    const touch = finger(100, 200, 1);
    const offCanvas = finger(380, 700, 2);

    push.touchStart({ touches: [touch], changed: [touch] }, canvasAt(0, 100));
    push.touchMove({ touches: [touch, offCanvas], changed: [touch] }, canvasAt(0, 100));
    expect(push.getPhase()).toBe('pinch');
    expect(push.frame(canvasAt(0, 70))).toBeUndefined();
  });

  it("ignores a resting finger's wobble", () => {
    const push = setUp();
    const touch = finger(100, 200);
    const wobble = finger(100 + RESTING_WOBBLE_PX - 1, 200 + 1);

    push.touchStart({ touches: [touch], changed: [touch] }, canvasAt(0, 100));
    push.touchMove({ touches: [wobble], changed: [wobble] }, canvasAt(0, 100));
    expect(push.frame(canvasAt(0, 100))).toBeUndefined();
  });

  it('says when a lone finger lands, and not when a pinch starts', () => {
    const onContactStart = vi.fn();
    const push = createPushTracker(onContactStart);
    const first = finger(100, 200, 1);
    const second = finger(200, 250, 2);

    push.touchStart({ touches: [first], changed: [first] }, canvasAt(0, 100));
    push.touchStart({ touches: [first, second], changed: [second] }, canvasAt(0, 100));
    expect(onContactStart).toHaveBeenCalledTimes(1);
  });

  it('gives a stroke no presence once the brush is off the canvas', () => {
    const push = setUp();
    const touch = finger(100, 200);
    const offCanvas = finger(330, 200);

    push.touchStart({ touches: [touch], changed: [touch] }, canvasAt(0, 100));
    push.touchMove({ touches: [offCanvas], changed: [offCanvas] }, canvasAt(0, 100));
    expect(push.frame(canvasAt(0, 100))).toEqual(stroke([1 / 3, 1 / 3], [1.1, 1 / 3], 0));
  });
});

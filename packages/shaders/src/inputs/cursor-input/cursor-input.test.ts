import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CursorInput } from './cursor-input.js';

function simulateMouseAt(x: number, y: number, size = 1000) {
  Object.defineProperty(window, 'innerWidth', {
    value: size,
    configurable: true,
  });
  Object.defineProperty(window, 'innerHeight', {
    value: size,
    configurable: true,
  });
  window.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y }));
}

// A 400 by 300 element at viewport (100, 200), so a pointer at (300, 350)
// is at its center and one at (600, 350) is past its right edge.
const fakeElement = {
  getBoundingClientRect: () => ({ left: 100, top: 200, width: 400, height: 300 }),
};

const firePointerMove = (clientX: number, clientY: number) => {
  window.dispatchEvent(new PointerEvent('pointermove', { clientX, clientY }));
};

describe('CursorInput', () => {
  beforeEach(() => {
    // happy-dom provides window/document; we just need a clean event slate.
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('the shared raw target', () => {
    it('follows a window pointermove, normalized to the element rect', () => {
      const cursor = new CursorInput({ element: fakeElement });

      expect(cursor.getTarget()).toBeNull();

      firePointerMove(300, 350);

      expect(cursor.getTarget()).toEqual([0.5, 0.5]);
      cursor.dispose();
    });

    it('keeps following a pointer that runs past the element edge', () => {
      const cursor = new CursorInput({ element: fakeElement });

      firePointerMove(600, 350);

      expect(cursor.getTarget()).toEqual([1.25, 0.5]);
      cursor.dispose();
    });

    it('reports whether the pointer is inside the element rect, and nothing before the first move', () => {
      const cursor = new CursorInput({ element: fakeElement });

      expect(cursor.isInside()).toBe(false);

      firePointerMove(300, 350);
      expect(cursor.isInside()).toBe(true);

      firePointerMove(600, 350);
      expect(cursor.isInside()).toBe(false);

      // The edge itself counts as inside on the near side and outside past
      // the far side, matching a 0..1 canvas.
      firePointerMove(100, 200);
      expect(cursor.isInside()).toBe(true);
      firePointerMove(500, 500);
      expect(cursor.isInside()).toBe(false);
      cursor.dispose();
    });
  });

  it('starts at the configured initial position', () => {
    const cursor = new CursorInput({ initial: [0.25, 0.75] });

    expect(cursor.get()).toEqual([0.25, 0.75]);
    cursor.dispose();
  });

  it('updates target on mousemove (in normalized 0..1 coordinates)', () => {
    const cursor = new CursorInput({ smoothing: 0 }); // no smoothing — read raw target

    Object.defineProperty(window, 'innerWidth', {
      value: 1000,
      configurable: true,
    });
    Object.defineProperty(window, 'innerHeight', {
      value: 500,
      configurable: true,
    });

    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 500, clientY: 250 }));
    cursor.tick(1); // advance one full second; with smoothing 0, value snaps to target instantly

    expect(cursor.get()).toEqual([0.5, 0.5]);
    cursor.dispose();
  });

  it('approaches the target gradually when smoothing > 0', () => {
    const cursor = new CursorInput({ smoothing: 0.5, initial: [0, 0] });

    Object.defineProperty(window, 'innerWidth', {
      value: 1000,
      configurable: true,
    });
    Object.defineProperty(window, 'innerHeight', {
      value: 1000,
      configurable: true,
    });

    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 1000, clientY: 1000 }));

    cursor.tick(0.016); // 16ms tick
    const after1 = cursor.get();

    expect(after1[0]).toBeGreaterThan(0);
    expect(after1[0]).toBeLessThan(1);

    cursor.tick(0.016);
    const after2 = cursor.get();

    expect(after2[0]).toBeGreaterThan(after1[0]); // monotonically approaching target
    cursor.dispose();
  });

  it('notifies subscribers on change', () => {
    const cursor = new CursorInput({ smoothing: 0 });
    const sub = vi.fn();

    cursor.on('change', sub);
    simulateMouseAt(500, 500);
    cursor.tick(1);

    expect(sub).toHaveBeenCalled();
    expect(sub.mock.calls[0]?.[0]).toEqual([0.5, 0.5]);
    cursor.dispose();
  });

  it('removes listeners on dispose', () => {
    const cursor = new CursorInput({ smoothing: 0 });
    const sub = vi.fn();

    cursor.on('change', sub);
    cursor.dispose();
    simulateMouseAt(500, 500);
    cursor.tick(1);

    expect(sub).not.toHaveBeenCalled();
  });

  it('normalizes against an element rect when `element` is supplied', () => {
    // Cursor at viewport (300, 350) is at element-relative (200, 150), the
    // center of the 400 by 300 fake element, so element-normalized (0.5, 0.5).
    const cursor = new CursorInput({ smoothing: 0, element: fakeElement });

    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 300, clientY: 350 }));
    cursor.tick(1);

    expect(cursor.get()).toEqual([0.5, 0.5]);
    cursor.dispose();
  });

  it('reports from tick whether the position changed', () => {
    const cursor = new CursorInput({ smoothing: 0 });

    expect(cursor.tick(0.016)).toBe(false);

    simulateMouseAt(500, 500);
    expect(cursor.tick(0.016)).toBe(true);
    expect(cursor.tick(0.016)).toBe(false);
    cursor.dispose();
  });

  it('lands exactly on the target once the gap is under a device pixel, then settles', () => {
    // smoothing 0.5 closes half the remaining gap per 60fps frame, so a gap
    // of 1 canvas unit is 2^-14, under the settle threshold, on the 14th
    // tick. Exact float equality would take about 53 more.
    const cursor = new CursorInput({ smoothing: 0.5, initial: [0, 0] });

    simulateMouseAt(1000, 1000);

    let ticksUntilSettled = 0;

    while (cursor.tick(1 / 60) && ticksUntilSettled < 60) ticksUntilSettled += 1;

    expect(ticksUntilSettled).toBeLessThanOrEqual(15);
    expect(cursor.get()).toEqual([1, 1]);
    expect(cursor.tick(1 / 60)).toBe(false);
    cursor.dispose();
  });

  it('caps the first tick after a parked stretch, so the glide survives a wake', () => {
    // smoothing 0.5 over one 30fps frame closes 1 - 0.5^2 = 75% of the gap.
    // A five second delta, which is what the scheduler reports on the first
    // tick after the scene parks, would close all of it and snap.
    const cursor = new CursorInput({ smoothing: 0.5, initial: [0, 0] });

    simulateMouseAt(1000, 1000);
    cursor.tick(5, true);

    expect(cursor.get()[0]).toBeCloseTo(0.75, 6);
    expect(cursor.get()[1]).toBeCloseTo(0.75, 6);
    cursor.dispose();
  });

  it('uses the full delta for an ordinary slow frame', () => {
    const cursor = new CursorInput({ smoothing: 0.9, initial: [0, 0] });

    simulateMouseAt(1000, 1000);
    cursor.tick(0.8);

    const expected = 1 - Math.pow(0.9, 0.8 * 60);

    expect(cursor.get()[0]).toBeCloseTo(expected, 6);
    expect(cursor.get()[1]).toBeCloseTo(expected, 6);
    cursor.dispose();
  });

  it('tells every move subscriber about each pointer move, and none after dispose', () => {
    const firstSubscriber = vi.fn();
    const secondSubscriber = vi.fn();
    const cursor = new CursorInput();

    cursor.onMove(firstSubscriber);
    cursor.onMove(secondSubscriber);
    simulateMouseAt(100, 100);
    simulateMouseAt(200, 200);

    expect(firstSubscriber).toHaveBeenCalledTimes(2);
    expect(secondSubscriber).toHaveBeenCalledTimes(2);

    cursor.dispose();
    simulateMouseAt(300, 300);

    expect(firstSubscriber).toHaveBeenCalledTimes(2);
    expect(secondSubscriber).toHaveBeenCalledTimes(2);
  });

  it('stops telling a move subscriber once it unsubscribes, leaving the others', () => {
    const leaving = vi.fn();
    const staying = vi.fn();
    const cursor = new CursorInput();
    const unsubscribe = cursor.onMove(leaving);

    cursor.onMove(staying);
    simulateMouseAt(100, 100);
    unsubscribe();
    simulateMouseAt(200, 200);

    expect(leaving).toHaveBeenCalledTimes(1);
    expect(staying).toHaveBeenCalledTimes(2);
    cursor.dispose();
  });
});

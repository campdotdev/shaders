import { describe, expect, it } from 'vitest';

import { computeLayout, scrubAt } from './geometry';

// A 1440 by 900 window: the container is 1440 less the two 32px gutters.
const WIDE = { width: 1376, viewportHeight: 900 };

describe('computeLayout', () => {
  it('pins once the end state fits side by side', () => {
    expect(computeLayout(WIDE).pinned).toBe(true);
  });

  it('does not pin where the end state would stack', () => {
    expect(computeLayout({ width: 815, viewportHeight: 900 }).pinned).toBe(false);
  });

  // The end state is the 597.33px scene plus the pin's 32px above and below.
  it('does not pin where the end state is taller than the viewport', () => {
    expect(computeLayout({ width: 1376, viewportHeight: 662 }).pinned).toBe(true);
    expect(computeLayout({ width: 1376, viewportHeight: 661 }).pinned).toBe(false);
  });

  it('measures the end state with the hero section padding, for the fit check', () => {
    expect(computeLayout(WIDE).endHeight).toBe(896 / 1.5 + 64);
  });

  it('ends on the 896px scene column, centered with the panel as one group', () => {
    const { frameEnd, panel } = computeLayout(WIDE);
    const group = 896 + 16 + 288;

    expect(frameEnd).toEqual({ x: (1376 - group) / 2, width: 896, sceneHeight: 896 / 1.5 });
    expect(panel.x).toBe(frameEnd.x + 896 + 16);
  });

  it('narrows the scene column to leave room for the panel', () => {
    const { frameEnd } = computeLayout({ width: 1000, viewportHeight: 900 });

    expect(frameEnd.width).toBe(1000 - 16 - 288);
  });
});

describe('scrubAt', () => {
  const layout = computeLayout(WIDE);

  it('starts as the full-width hero inside its 14px frame inset', () => {
    const frame = scrubAt(layout, 0);

    expect(frame).toMatchObject({ x: 0, width: 1376, inset: 14, radius: 24 });
    expect(frame.sceneHeight).toBeCloseTo((1376 - 28) / (1636 / 696));
  });

  it('starts changing as soon as the page scrolls', () => {
    expect(scrubAt(layout, 0.01).width).toBeLessThan(1376);
  });

  it('ends as the demo, with the scene filling the frame', () => {
    expect(scrubAt(layout, 1)).toMatchObject({
      x: layout.frameEnd.x,
      width: 896,
      sceneHeight: 896 / 1.5,
      inset: 0,
      radius: 12,
      panelX: layout.panel.x,
      panelMask: 'none',
    });
  });

  // The pin releases at 1, and the favorites reach their place under it
  // then, so the panel lands as they do rather than before.
  it('keeps changing until the pin releases', () => {
    expect(scrubAt(layout, 0.99).panelX).toBeGreaterThan(layout.panel.x);
  });

  it('keeps the panel one gap to the right of the frame mid-change', () => {
    const frame = scrubAt(layout, 0.45);

    expect(frame.panelX).toBeCloseTo(frame.x + frame.width + 16);
  });

  it('starts the panel past the container edge', () => {
    expect(scrubAt(layout, 0).panelX).toBeGreaterThan(1376);
  });

  // The panel's outline shares the frame's top and bottom the whole way:
  // the frame's height is its scene plus the inset above and below.
  it('keeps the panel as tall as the frame through the change', () => {
    for (const progress of [0, 0.3, 0.6, 1]) {
      const frame = scrubAt(layout, progress);

      expect(frame.panelHeight).toBeCloseTo(frame.sceneHeight + 2 * frame.inset);
    }
  });

  it('lands the panel at the demo scene height', () => {
    expect(scrubAt(layout, 1).panelHeight).toBe(896 / 1.5);
  });

  it('fades the panel toward the container edge while it travels', () => {
    expect(scrubAt(layout, 0.45).panelMask).toMatch(/^linear-gradient\(to right/);
  });

  it('leaves the panel unmasked once it lands', () => {
    expect(scrubAt(layout, 1).panelMask).toBe('none');
  });
});

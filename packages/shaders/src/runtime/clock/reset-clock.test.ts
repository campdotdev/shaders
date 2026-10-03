import type { WebGPURenderer } from 'three/webgpu';
import { describe, expect, it } from 'vitest';

import { holdRendererClock, resetRendererClock } from './reset-clock.js';

// Build a minimal object shaped like the internal slice of WebGPURenderer the
// util reaches into. Cast through unknown because the real `_nodes`/`nodeFrame`
// fields are not part of three's public type.
function makeRenderer(nodeFrame: unknown): WebGPURenderer {
  return { _nodes: { nodeFrame } } as unknown as WebGPURenderer;
}

describe('resetRendererClock', () => {
  it('zeroes time and deltaTime and clears lastTime', () => {
    const nodeFrame = { time: 12.5, deltaTime: 0.016, lastTime: 12.484 };

    resetRendererClock(makeRenderer(nodeFrame));

    expect(nodeFrame.time).toBe(0);
    expect(nodeFrame.deltaTime).toBe(0);
    expect(nodeFrame.lastTime).toBeUndefined();
  });

  it('no-ops when _nodes is missing', () => {
    const renderer = {} as unknown as WebGPURenderer;

    expect(() => resetRendererClock(renderer)).not.toThrow();
  });

  it('no-ops when nodeFrame is missing', () => {
    expect(() => resetRendererClock(makeRenderer(undefined))).not.toThrow();
  });

  it('no-ops when nodeFrame is not an object', () => {
    expect(() => resetRendererClock(makeRenderer(42))).not.toThrow();
  });
});

describe('holdRendererClock', () => {
  // three's own animation loop advances nodeFrame.time on every animation
  // frame, rendering or not, so a paused scene's clock keeps running. The
  // hold puts it back to the time it was taken at.
  it('sets time back to where it was held', () => {
    const nodeFrame = { time: 12.5, deltaTime: 0.016, lastTime: 12_484 };
    const restore = holdRendererClock(makeRenderer(nodeFrame));

    nodeFrame.time = 20;
    nodeFrame.deltaTime = 0.016;
    restore();

    expect(nodeFrame.time).toBe(12.5);
    expect(nodeFrame.deltaTime).toBe(0);
  });

  // three's loop stops while the tab is hidden, so its lastTime goes stale,
  // and its next tick would add the whole hidden gap. Clearing lastTime
  // makes that tick measure from itself.
  it('clears lastTime, so three adds no time on its next tick', () => {
    const nodeFrame = { time: 12.5, deltaTime: 0.016, lastTime: 12_484 };
    const restore = holdRendererClock(makeRenderer(nodeFrame));

    restore();

    expect(nodeFrame.lastTime).toBeUndefined();
  });

  it('restores to the same time every time it runs', () => {
    const nodeFrame = { time: 3 };
    const restore = holdRendererClock(makeRenderer(nodeFrame));

    nodeFrame.time = 4;
    restore();
    nodeFrame.time = 5;
    restore();

    expect(nodeFrame.time).toBe(3);
  });

  it('no-ops when nodeFrame is missing', () => {
    expect(() => holdRendererClock(makeRenderer(undefined))()).not.toThrow();
  });
});

import type { WebGPURenderer } from 'three/webgpu';
import { describe, expect, it } from 'vitest';

import { resetRendererClock } from './reset-clock.js';

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

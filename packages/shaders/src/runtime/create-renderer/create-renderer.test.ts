import { WebGPURenderer } from 'three/webgpu';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createRenderer } from './create-renderer.js';

// init() is the one step that needs a GPU device. The rest of what
// createRenderer asks of three runs on the renderer object alone, so the
// tests skip init and read the settings three resolved from the options.
beforeEach(() => {
  vi.spyOn(WebGPURenderer.prototype, 'init').mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createRenderer', () => {
  it('keeps one sample and no depth value per pixel by default', async () => {
    const { three } = await createRenderer(document.createElement('canvas'));

    expect(three.samples).toBe(0);
    expect(three.depth).toBe(false);
  });

  it('turns MSAA back on when the caller asks for antialias', async () => {
    const { three } = await createRenderer(document.createElement('canvas'), { antialias: true });

    expect(three.samples).toBe(4);
  });
});

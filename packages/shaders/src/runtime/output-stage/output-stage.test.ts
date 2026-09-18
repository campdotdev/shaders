import { OrthographicCamera, Scene } from 'three';
import type { QuadMesh, WebGPURenderer } from 'three/webgpu';
import { describe, expect, it, vi } from 'vitest';

import { createOutputStage } from './output-stage.js';

// The stage only reads and writes the renderer's tone mapping and output
// color space, and asks it to draw one object, so a plain object stands in.
function makeRenderer() {
  return { render: vi.fn(), toneMapping: 3, outputColorSpace: 'srgb' } as unknown as WebGPURenderer;
}

const drawnQuad = (renderer: WebGPURenderer) =>
  vi.mocked(renderer.render).mock.calls.at(-1)?.[0] as QuadMesh | undefined;

describe('createOutputStage', () => {
  it('draws one quad and restores the renderer settings after the draw', () => {
    const renderer = makeRenderer();
    const stage = createOutputStage(renderer, new Scene(), new OrthographicCamera());

    stage.render();

    expect(renderer.render).toHaveBeenCalledTimes(1);
    expect(drawnQuad(renderer)?.isQuadMesh).toBe(true);
    expect(renderer.toneMapping).toBe(3);
    expect(renderer.outputColorSpace).toBe('srgb');
  });

  // The draw switches tone mapping and the output color space off for one
  // quad. A throw inside it must not leave them off, or the next rebuild
  // would bake the wrong settings into the quad's material.
  it('restores the renderer settings when the draw throws', () => {
    const renderer = makeRenderer();
    const stage = createOutputStage(renderer, new Scene(), new OrthographicCamera());

    vi.mocked(renderer.render).mockImplementationOnce(() => {
      throw new Error('device lost');
    });

    expect(() => stage.render()).toThrow('device lost');
    expect(renderer.toneMapping).toBe(3);
    expect(renderer.outputColorSpace).toBe('srgb');
  });

  // three 0.170's PostProcessing shares one quad and one material across
  // every instance, which is why this module exists.
  it('gives every stage its own quad and material', () => {
    const first = makeRenderer();
    const second = makeRenderer();

    createOutputStage(first, new Scene(), new OrthographicCamera()).render();
    createOutputStage(second, new Scene(), new OrthographicCamera()).render();

    const firstQuad = drawnQuad(first);
    const secondQuad = drawnQuad(second);

    expect(firstQuad).toBeDefined();
    expect(firstQuad).not.toBe(secondQuad);
    expect(firstQuad?.material).not.toBe(secondQuad?.material);
  });

  it('counts overlays and rebuilds the output when one registers or leaves', () => {
    const renderer = makeRenderer();
    const stage = createOutputStage(renderer, new Scene(), new OrthographicCamera());

    stage.render();
    const material = drawnQuad(renderer)?.material as { version: number };
    const versionBefore = material.version;

    expect(stage.hasOverlays()).toBe(false);

    const remove = stage.registerOverlay((input) => input);

    expect(stage.hasOverlays()).toBe(true);
    expect(material.version).toBeGreaterThan(versionBefore);

    const versionWithOverlay = material.version;

    remove();
    expect(stage.hasOverlays()).toBe(false);
    expect(material.version).toBeGreaterThan(versionWithOverlay);
  });

  it('disposes the quad material', () => {
    const renderer = makeRenderer();
    const stage = createOutputStage(renderer, new Scene(), new OrthographicCamera());

    stage.render();
    const material = drawnQuad(renderer)?.material as { dispose: () => void };
    const dispose = vi.spyOn(material, 'dispose');

    stage.dispose();
    expect(dispose).toHaveBeenCalledTimes(1);
  });
});

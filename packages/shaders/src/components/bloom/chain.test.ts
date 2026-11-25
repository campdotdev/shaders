// Unit tests for the bloom's blur chain, through a stub renderer: which
// textures the chain allocates, at what sizes, and in what order it draws
// them, never what the glow looks like. The look is the probe page.
import { float, uv, vec4 } from 'three/tsl';
import {
  HalfFloatType,
  type Node,
  NodeUpdateType,
  type RenderTarget,
  type WebGPURenderer,
} from 'three/webgpu';
import { describe, expect, it, vi } from 'vitest';

import type { ShaderContextValue } from '../../react/context/shader-context.js';
import type { ResizeValue } from '../../react/hooks/use-resize/use-resize.js';
import { createBloomChain, firstLevelScale, levelCount, levelSize } from './chain.js';

interface SceneOptions {
  /** Whether the WebGL2 fallback lacks the extension for float targets. */
  noFloatTargets?: boolean;
  /** The longest texture side the WebGPU device allows, in texels. */
  maxSide?: number;
}

/**
 * A scene whose canvas starts at 800 by 400 CSS pixels at a pixel ratio of
 * 2, so 1600 by 800 device pixels, and can be resized by hand. The renderer
 * remembers every target a draw was bound to.
 */
function makeScene({ noFloatTargets = false, maxSide }: SceneOptions = {}) {
  let boundTarget: RenderTarget | null = null;
  const drawnInto: RenderTarget[] = [];
  const listeners = new Set<(value: ResizeValue) => void>();
  let size: ResizeValue = [800, 400, 2];
  const renderer = {
    getPixelRatio: () => 2,
    render: vi.fn(() => {
      if (boundTarget) drawnInto.push(boundTarget);
    }),
    setRenderTarget: vi.fn((target: RenderTarget | null) => {
      boundTarget = target;
    }),
    getRenderTarget: vi.fn(() => boundTarget),
    backend: noFloatTargets
      ? { isWebGLBackend: true, extensions: { has: () => false } }
      : {
          device:
            maxSide === undefined ? undefined : { limits: { maxTextureDimension2D: maxSide } },
        },
  } as unknown as WebGPURenderer;
  const scheduler = { requestRender: vi.fn(() => true) };
  const shaderContext = {
    renderer: { three: renderer },
    scheduler,
    canvasSize: {
      get: () => size,
      on: (_event: 'change', listener: (value: ResizeValue) => void) => {
        listeners.add(listener);

        return () => {
          listeners.delete(listener);
        };
      },
    },
  } as unknown as ShaderContextValue;

  const resizeCanvas = (next: ResizeValue) => {
    size = next;
    for (const listener of listeners) listener(next);
  };

  return { shaderContext, renderer, scheduler, drawnInto, listeners, resizeCanvas };
}

/** The node whose updateBefore draws the chain, found in a read of the glow. */
function drawNodeOf(glow: Node) {
  let found: Node | undefined;

  glow.traverse((node) => {
    if ('passNode' in node) found = (node as unknown as { passNode: Node }).passNode;
  });
  if (!found) throw new Error('expected the glow to carry the node that draws the chain');

  return found as Node & { updateBefore: () => void };
}

/** A started chain, the function that draws it once, and the function that stops it. */
function startChain(scene: ReturnType<typeof makeScene>, isOn?: () => boolean) {
  const chain = createBloomChain(float(0.5), isOn);
  const glow = chain.glowAt(uv());
  const stop = chain.start(scene.shaderContext);
  const drawNode = drawNodeOf(glow);
  const draw = () => {
    scene.drawnInto.length = 0;
    drawNode.updateBefore();

    return scene.drawnInto.map((target) => [target.width, target.height]);
  };

  return { chain, glow, drawNode, draw, stop };
}

describe('levelCount', () => {
  it('halves the height until one more halving would drop below 8 texels', () => {
    expect(levelCount(1392)).toBe(7);
    expect(levelCount(696)).toBe(6);
    expect(levelCount(800)).toBe(6);
  });

  it('adds one level when the canvas doubles', () => {
    expect(levelCount(1600)).toBe(levelCount(800) + 1);
  });

  it('builds at least 2 levels, so every level has an up pass to weight it, and at most 8', () => {
    expect(levelCount(0)).toBe(2);
    expect(levelCount(10)).toBe(2);
    expect(levelCount(31)).toBe(2);
    expect(levelCount(100_000)).toBe(8);
  });
});

describe('levelSize', () => {
  it('halves the canvas for level 0 and halves again for each level after', () => {
    expect(levelSize(1600, 800, 0)).toEqual([800, 400]);
    expect(levelSize(1600, 800, 1)).toEqual([400, 200]);
    expect(levelSize(1600, 800, 5)).toEqual([25, 13]);
  });

  it('never goes below one texel a side', () => {
    expect(levelSize(3, 3, 6)).toEqual([1, 1]);
  });
});

// A level's scale is the log2 of its height in texels. The glow's weights
// are worked out from it, so the glow keeps its size as a share of the
// canvas at any resolution.
describe('firstLevelScale', () => {
  it('is the log2 of half the canvas height', () => {
    expect(firstLevelScale(512)).toBe(8);
    expect(firstLevelScale(1024)).toBe(9);
    expect(firstLevelScale(1392)).toBeCloseTo(9.443, 3);
  });

  it('stays finite on a canvas with no height', () => {
    expect(firstLevelScale(0)).toBe(-1);
  });
});

describe('createBloomChain', () => {
  it('allocates and draws nothing until started', () => {
    const scene = makeScene();
    const chain = createBloomChain(float(0.5));

    drawNodeOf(chain.glowAt(uv())).updateBefore();

    expect(scene.renderer.render).not.toHaveBeenCalled();
  });

  // three calls updateBefore once a frame on a node with this type, before
  // it draws a material whose graph holds the node.
  it('draws from a node that updates once a frame', () => {
    const scene = makeScene();
    const { drawNode } = startChain(scene);

    expect(drawNode.updateBeforeType).toBe(NodeUpdateType.FRAME);
  });

  // 800 device pixels tall is 6 levels: 6 shrinking draws from the largest
  // level down, then 5 blending draws from the second-smallest back up.
  it('draws down the levels and back up, each into a half-float target', () => {
    const scene = makeScene();
    const { draw } = startChain(scene);

    expect(draw()).toEqual([
      [800, 400],
      [400, 200],
      [200, 100],
      [100, 50],
      [50, 25],
      [25, 13],
      [50, 25],
      [100, 50],
      [200, 100],
      [400, 200],
      [800, 400],
    ]);
    expect(scene.drawnInto.every((target) => target.texture.type === HalfFloatType)).toBe(true);
  });

  // The source aims its reads at single canvas pixels with this.
  // It follows a resize when the chain next draws, with the levels.
  it('draws an up pass on a canvas too short to halve twice, so its glow is weighted', () => {
    const scene = makeScene();
    const { draw } = startChain(scene);

    // 16 by 10 device pixels: two levels down, then the first level's up pass.
    scene.resizeCanvas([8, 5, 2]);

    expect(draw()).toEqual([
      [8, 5],
      [4, 3],
      [8, 5],
    ]);
  });

  it("reports the first level's texel size, and follows a resize", () => {
    const scene = makeScene();
    const { chain, draw } = startChain(scene);
    const texel = chain.firstTexel.value;

    expect([texel.x, texel.y]).toEqual([1 / 800, 1 / 400]);
    scene.resizeCanvas([1600, 800, 2]);
    draw();

    expect(chain.firstTexel.value).toBe(texel);
    expect([texel.x, texel.y]).toEqual([1 / 1600, 1 / 800]);
  });

  // createTexturePass clamps a side past the device's limit, so the
  // filters have to step by the texels the level really has.
  it('sizes the texels to a level the device limit clamped', () => {
    const scene = makeScene({ maxSide: 512 });
    const { chain, draw } = startChain(scene);
    const texel = chain.firstTexel.value;

    expect(draw()[0]).toEqual([512, 400]);
    expect([texel.x, texel.y]).toEqual([1 / 512, 1 / 400]);
  });

  it('sizes the texels to the clamped level after a resize', () => {
    const scene = makeScene({ maxSide: 1024 });
    const { chain, draw } = startChain(scene);
    const texel = chain.firstTexel.value;

    expect([texel.x, texel.y]).toEqual([1 / 800, 1 / 400]);
    scene.resizeCanvas([1200, 400, 2]);

    expect(draw()[0]).toEqual([1024, 400]);
    expect([texel.x, texel.y]).toEqual([1 / 1024, 1 / 400]);
  });

  // Bloom turns the chain off at a strength of 0, where no one would see
  // the glow, so the frame pays for none of its draws.
  it("skips a frame's draws while it is off, and draws again once on", () => {
    const scene = makeScene();
    let on = false;
    const { draw } = startChain(scene, () => on);

    expect(draw()).toEqual([]);

    on = true;

    expect(draw()).toHaveLength(11);
  });

  it('restores the bound target after it draws', () => {
    const scene = makeScene();
    const { draw } = startChain(scene);

    draw();

    expect(scene.renderer.getRenderTarget()).toBeNull();
  });

  it('draws a new source into the first level without rebuilding the levels', () => {
    const scene = makeScene();
    const { chain, draw } = startChain(scene);

    draw();
    const firstLevel = scene.drawnInto[0];
    const source = vec4(1, 0, 0, 1);

    chain.setSource(source);
    draw();

    expect(scene.drawnInto[0]).toBe(firstLevel);
    const [quad] = vi.mocked(scene.renderer.render).mock.calls.at(-11) ?? [];

    expect((quad as unknown as { material: { fragmentNode: unknown } }).material.fragmentNode).toBe(
      source,
    );
  });

  it('keeps a source set before start', () => {
    const scene = makeScene();
    const chain = createBloomChain(float(0.5));
    const source = vec4(1, 0, 0, 1);

    chain.setSource(source);
    chain.start(scene.shaderContext);
    drawNodeOf(chain.glowAt(uv())).updateBefore();
    const [quad] = vi.mocked(scene.renderer.render).mock.calls[0] ?? [];

    expect((quad as unknown as { material: { fragmentNode: unknown } }).material.fragmentNode).toBe(
      source,
    );
  });

  describe('on a resize', () => {
    it('resizes the same targets while the number of levels holds', () => {
      const scene = makeScene();
      const { draw } = startChain(scene);

      draw();
      const before = [...scene.drawnInto];

      scene.resizeCanvas([900, 450, 2]);

      expect(draw().slice(0, 2)).toEqual([
        [900, 450],
        [450, 225],
      ]);
      expect(scene.drawnInto).toEqual(before);
    });

    // A resize empties a target, and the scene's redraw after a resize
    // may draw no chain, so the targets keep their size, and the last
    // frame's glow, until the chain next draws.
    it('leaves the targets as they are until the next draw', () => {
      const scene = makeScene();
      const { draw } = startChain(scene);

      draw();
      const sizes = () => scene.drawnInto.map((target) => [target.width, target.height]);
      const before = sizes();

      scene.resizeCanvas([900, 450, 2]);

      expect(sizes()).toEqual(before);
    });

    it('builds the levels again when their number changes', () => {
      const scene = makeScene();
      const { draw } = startChain(scene);

      expect(draw()).toHaveLength(11);
      scene.resizeCanvas([1600, 800, 2]);

      expect(draw()).toHaveLength(13);
    });

    it('asks for a frame, so a parked scene redraws at the new size', () => {
      const scene = makeScene();

      startChain(scene);
      scene.scheduler.requestRender.mockClear();
      scene.resizeCanvas([900, 450, 2]);

      expect(scene.scheduler.requestRender).toHaveBeenCalled();
    });
  });

  it('draws nothing and stops following the canvas after it stops', () => {
    const scene = makeScene();
    const { draw, stop } = startChain(scene);

    stop();

    expect(draw()).toEqual([]);
    expect(scene.listeners.size).toBe(0);
  });

  // The output shader samples the stand-in until the chain builds, and for
  // good on a renderer without half-float targets, so three gives it a GPU
  // texture that only its dispose frees.
  it.each([
    ['after a built chain', {}],
    ['on a renderer without half-float targets', { noFloatTargets: true }],
  ] as const)('releases the stand-in when it stops, %s', (_name, options) => {
    const scene = makeScene(options);
    const chain = createBloomChain(float(0.5));
    let standIn: { addEventListener: (type: 'dispose', listener: () => void) => void } | undefined;

    chain.glowAt(uv()).traverse((node) => {
      if ('passNode' in node) standIn = (node as unknown as { value: typeof standIn }).value;
    });
    const onDispose = vi.fn();

    standIn?.addEventListener('dispose', onDispose);
    chain.start(scene.shaderContext)();

    expect(onDispose).toHaveBeenCalledOnce();
  });

  // Strict Mode stops a chain and starts the same one again. Without
  // half-float targets the second start builds no levels, so the output
  // keeps sampling the stand-in the first stop disposed. three uploads a
  // texture it dropped only once its version moves.
  it('marks the stand-in for upload again when it starts after a stop', () => {
    const scene = makeScene({ noFloatTargets: true });
    const chain = createBloomChain(float(0.5));
    let standIn: { version: number } | undefined;

    chain.glowAt(uv()).traverse((node) => {
      if ('passNode' in node) standIn = (node as unknown as { value: typeof standIn }).value;
    });
    chain.start(scene.shaderContext)();
    const versionAtStop = standIn?.version ?? 0;

    chain.start(scene.shaderContext);

    expect(standIn?.version).toBeGreaterThan(versionAtStop);
  });

  // Without half-float targets Bloom has no glow, and the image passes
  // through unchanged.
  it('builds nothing on a renderer that cannot draw into half-float targets', () => {
    const scene = makeScene({ noFloatTargets: true });
    const { draw } = startChain(scene);

    expect(draw()).toEqual([]);
  });
});

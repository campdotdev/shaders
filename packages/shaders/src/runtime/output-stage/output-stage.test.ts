import { OrthographicCamera, Scene } from 'three';
import { type ShaderNodeObject, vec2 } from 'three/tsl';
import type {
  Node,
  NodeMaterial,
  PassNode,
  QuadMesh,
  TextureNode,
  WebGPURenderer,
} from 'three/webgpu';
import { describe, expect, it, vi } from 'vitest';

import {
  createOutputStage,
  type PostProcessTransform,
  type Resample,
  type UvTransform,
} from './output-stage.js';

// The stage only reads and writes the renderer's tone mapping and output
// color space, and asks it to draw one object, so a plain object stands in.
function makeRenderer() {
  return { render: vi.fn(), toneMapping: 3, outputColorSpace: 'srgb' } as unknown as WebGPURenderer;
}

const drawnQuad = (renderer: WebGPURenderer) =>
  vi.mocked(renderer.render).mock.calls.at(-1)?.[0] as QuadMesh | undefined;

// A UV warp as the stage sees it: a resample that samples the image beneath
// it once, at a moved coordinate. useBasePassUv registers the same shape.
const warpResample =
  (warp: UvTransform): Resample =>
  (sampleBeneath) =>
  (coordinate) =>
    sampleBeneath(warp(coordinate));

// A resample that samples the image beneath it twice, the way a color split
// samples it three times.
const sampleTwice: Resample = (sampleBeneath) => (coordinate) =>
  sampleBeneath(coordinate).add(sampleBeneath(coordinate.add(vec2(0.1, 0))));

// uv(), the output quad's 0..1 screen position, is three's attribute node
// for the quad's uv attribute.
const isScreenCoordinate = (node: ShaderNodeObject<Node> | undefined) =>
  (node as unknown as { getAttributeName?: () => string } | undefined)?.getAttributeName?.() ===
  'uv';

// Every read of the scene's texture in the material's current graph. A read
// is a pass texture node with a coordinate. Each read also points back at
// the bare pass texture it was cloned from, which has none. The graph can
// reach one node along more than one path, so the map keeps each read once.
function sceneReads(material: NodeMaterial): TextureNode[] {
  const reads = new Map<number, TextureNode>();

  material.fragmentNode?.traverse((node) => {
    if (!('passNode' in node)) return;
    const read = node as unknown as TextureNode;

    if (read.uvNode !== null) reads.set(read.id, read);
  });

  return [...reads.values()];
}

function renderedMaterial() {
  const renderer = makeRenderer();
  const stage = createOutputStage(renderer, new Scene(), new OrthographicCamera());

  stage.render();

  return { stage, material: drawnQuad(renderer)?.material as NodeMaterial };
}

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

  // With no resample, the base pass is the scene pass node itself, read with
  // no coordinate math.
  it('reads the scene through resamples only while one is registered', () => {
    const { stage, material } = renderedMaterial();
    const versionBefore = material.version;

    expect(sceneReads(material)).toHaveLength(0);

    const remove = stage.registerResample(warpResample((coordinate) => coordinate));

    expect(material.version).toBeGreaterThan(versionBefore);
    expect(sceneReads(material)).toHaveLength(1);

    const versionWithResample = material.version;

    remove();
    expect(material.version).toBeGreaterThan(versionWithResample);
    expect(sceneReads(material)).toHaveLength(0);
  });

  // The last-registered Effect wraps the samplers of every Effect beneath
  // it, so its UV warp moves the screen coordinate first and acts as the top
  // layer. <Dither /><CursorRipple /> then pixelates the image under the
  // water, not the water itself (docs/adr/0004).
  it('moves the screen coordinate through the last-registered UV warp first', () => {
    const { stage, material } = renderedMaterial();
    const calls: Array<{ warp: string; coordinate: ShaderNodeObject<Node> }> = [];
    const firstOutput = vec2(0.5, 0.5);
    const secondOutput = vec2(0.25, 0.75);

    stage.registerResample(
      warpResample((coordinate) => {
        calls.push({ warp: 'first', coordinate });

        return firstOutput;
      }),
    );
    calls.length = 0;
    stage.registerResample(
      warpResample((coordinate) => {
        calls.push({ warp: 'second', coordinate });

        return secondOutput;
      }),
    );

    expect(calls.map(({ warp }) => warp)).toEqual(['second', 'first']);
    expect(isScreenCoordinate(calls[0]?.coordinate)).toBe(true);
    expect(calls[1]?.coordinate).toBe(secondOutput);
    expect(sceneReads(material).map((read) => read.uvNode)).toEqual([firstOutput]);
  });

  // An Effect registers again, under the slot it first registered with,
  // whenever one of its dependencies changes. It keeps its place in the
  // stack rather than landing on top of the Effects mounted after it.
  it('puts a resample registered again under its slot back in its place', () => {
    const { stage } = renderedMaterial();
    const calls: string[] = [];
    const recording = (name: string) =>
      warpResample((coordinate) => {
        calls.push(name);

        return coordinate;
      });
    const firstSlot = {};
    const removeFirst = stage.registerResample(recording('first'), firstSlot);

    stage.registerResample(recording('second'));
    removeFirst();
    calls.length = 0;
    stage.registerResample(recording('first again'), firstSlot);

    expect(calls).toEqual(['second', 'first again']);
  });

  it('puts an overlay registered again under its slot back in its place', () => {
    const { stage } = renderedMaterial();
    const calls: string[] = [];
    const recording =
      (name: string): PostProcessTransform =>
      (input) => {
        calls.push(name);

        return input;
      };
    const firstSlot = {};
    const removeFirst = stage.registerOverlay(recording('first'), firstSlot);

    stage.registerOverlay(recording('second'));
    removeFirst();
    calls.length = 0;
    stage.registerOverlay(recording('first again'), firstSlot);

    expect(calls).toEqual(['first again', 'second']);
  });

  // FlutedGlass's color split takes three samples of the image beneath it.
  // Each sample reruns every UV warp beneath the resample, so a CursorRipple
  // under the glass bends all three.
  it('lets a resample sample the image beneath it more than once', () => {
    const { stage, material } = renderedMaterial();
    let warpRuns = 0;

    stage.registerResample(
      warpResample((coordinate) => {
        warpRuns += 1;

        return coordinate;
      }),
    );
    warpRuns = 0;
    stage.registerResample(sampleTwice);

    expect(warpRuns).toBe(2);
    expect(sceneReads(material)).toHaveLength(2);
  });

  // A texture node can run its coordinate through the texture's
  // offset-and-repeat matrix, a 3x3 multiply on every read (the
  // texture-matrix gotcha in docs/agents/tsl.md). three's pass texture
  // turns the matrix off, and so does each read cloned from it, which
  // matters once stacked resamples read the scene dozens of times a pixel.
  it('reads the scene texture without the texture matrix', () => {
    const { stage, material } = renderedMaterial();

    stage.registerResample(sampleTwice);

    const reads = sceneReads(material);

    expect(reads).toHaveLength(2);
    expect(reads.map((read) => read.updateMatrix)).toEqual([false, false]);
  });

  // A pre-pass draws something the scene's meshes read, such as Aurora's
  // field texture, so it has to land before the scene pass on every frame
  // and on the redraw after a resize, both of which call render().
  it('draws every pre-pass before the scene, in the order they registered, until removed', () => {
    const renderer = makeRenderer();
    const stage = createOutputStage(renderer, new Scene(), new OrthographicCamera());
    const draws: string[] = [];

    vi.mocked(renderer.render).mockImplementation(() => {
      draws.push('scene');

      return undefined;
    });
    stage.registerPrePass(() => draws.push('first'));
    const removeSecond = stage.registerPrePass(() => draws.push('second'));

    stage.render();
    removeSecond();
    stage.render();

    expect(draws).toEqual(['first', 'second', 'scene', 'first', 'scene']);
  });

  // Every component draws a full-screen quad at the same depth, so a depth
  // buffer behind the scene pass would never reject a pixel.
  it('renders the scene pass without a depth buffer', () => {
    const renderer = makeRenderer();
    const stage = createOutputStage(renderer, new Scene(), new OrthographicCamera());

    stage.render();
    const material = drawnQuad(renderer)?.material as NodeMaterial;
    // The output graph can reach one node along more than one path, so the
    // set keeps each pass once.
    const scenePasses = new Set<PassNode>();

    material.fragmentNode?.traverse((node) => {
      if ('isPassNode' in node) scenePasses.add(node as PassNode);
    });

    expect(scenePasses.size).toBe(1);
    expect([...scenePasses][0]?.renderTarget.depthBuffer).toBe(false);
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

// Tests the code emitter on emitted-source substrings and structure, plus a
// TypeScript parse check so a malformed template line fails here instead of
// in a user's project. The model is the MAT-96 probe's emit test; the graphs
// are the editor's own (starter graph + purpose-built chains).
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { emitComponentSource } from './emit';
import type { GraphEdge, GraphNode } from './graph';
import { defaultParamsOf, MAX_WARP_DRIVER_DEPTH } from './registry';
import type { SpecId } from './registry';
import { STARTER_EDGES, STARTER_NODES } from './starter-graph';

function node(id: string, spec: SpecId): GraphNode {
  return { id, spec, params: defaultParamsOf(spec) };
}

const starterNodes = STARTER_NODES.map(({ id, spec }) => node(id, spec));
const starterEdges: GraphEdge[] = STARTER_EDGES.map((edge) => ({ ...edge }));
const source = emitComponentSource(starterNodes, starterEdges, 'output-1');

/** Fails when TypeScript's parser reports syntax errors in emitted code. */
function expectParses(code: string) {
  const result = ts.transpileModule(code, { reportDiagnostics: true });

  expect(result.diagnostics ?? []).toEqual([]);
}

/** A generator wired through a ramp into Output — the smallest colored graph. */
function generatorGraph(spec: SpecId): { nodes: GraphNode[]; edges: GraphEdge[] } {
  return {
    nodes: [node('gen-1', spec), node('ramp-1', 'colorRamp'), node('output-1', 'output')],
    edges: [
      { source: 'gen-1', target: 'ramp-1', targetHandle: 'in' },
      { source: 'ramp-1', target: 'output-1', targetHandle: 'in' },
    ],
  };
}

/** Ramp -> one adjust card -> Output. */
function adjustGraph(spec: SpecId): { nodes: GraphNode[]; edges: GraphEdge[] } {
  return {
    nodes: [node('ramp-1', 'colorRamp'), node('adjust-1', spec), node('output-1', 'output')],
    edges: [
      { source: 'ramp-1', target: 'adjust-1', targetHandle: 'in' },
      { source: 'adjust-1', target: 'output-1', targetHandle: 'in' },
    ],
  };
}

/**
 * A warp chain wired driver-into-driver: warp-1 by warp-2 by ... by noise,
 * every warp sourcing the same gradient, the top warp feeding ramp -> output.
 */
function warpChainGraph(warpCount: number): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const warpIds = Array.from({ length: warpCount }, (_, index) => `warp-${index + 1}`);

  return {
    nodes: [
      node('gradient-1', 'gradient'),
      node('noise-1', 'noise'),
      ...warpIds.map((id) => node(id, 'warp')),
      node('ramp-1', 'colorRamp'),
      node('output-1', 'output'),
    ],
    edges: [
      ...warpIds.map((id) => ({ source: 'gradient-1', target: id, targetHandle: 'source' })),
      // Each warp is driven by the next one down; the deepest by the noise.
      ...warpIds.map((id, index) => ({
        source: warpIds[index + 1] ?? 'noise-1',
        target: id,
        targetHandle: 'by',
      })),
      { source: 'warp-1', target: 'ramp-1', targetHandle: 'in' },
      { source: 'ramp-1', target: 'output-1', targetHandle: 'in' },
    ],
  };
}

/**
 * A shared warp (gradient warped by noise) referenced twice: once directly
 * from Blend (depth 0), once as the driver at the bottom of a warp chain long
 * enough that the reference sits exactly at the depth cap. `sharedFirst`
 * controls which reference the walk reaches first (Blend emits `in` before
 * `with`) — the helper cache must give the same answer in both orders: the
 * real warp at the shallow reference, a pass-through at the capped one.
 */
function sharedWarpFanOutGraph(sharedFirst: boolean): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const chainIds = Array.from(
    { length: MAX_WARP_DRIVER_DEPTH },
    (_, index) => `chain-${index + 1}`,
  );

  return {
    nodes: [
      node('gradient-1', 'gradient'),
      node('noise-1', 'noise'),
      node('shared-1', 'warp'),
      ...chainIds.map((id) => node(id, 'warp')),
      node('blend-1', 'blend'),
      node('ramp-1', 'colorRamp'),
      node('output-1', 'output'),
    ],
    edges: [
      { source: 'gradient-1', target: 'shared-1', targetHandle: 'source' },
      { source: 'noise-1', target: 'shared-1', targetHandle: 'by' },
      ...chainIds.map((id) => ({ source: 'gradient-1', target: id, targetHandle: 'source' })),
      // chain-1 by chain-2 by ... by the shared warp, which therefore sits at
      // driver depth MAX_WARP_DRIVER_DEPTH — exactly where the cap applies.
      ...chainIds.map((id, index) => ({
        source: chainIds[index + 1] ?? 'shared-1',
        target: id,
        targetHandle: 'by',
      })),
      { source: sharedFirst ? 'shared-1' : 'chain-1', target: 'blend-1', targetHandle: 'in' },
      { source: sharedFirst ? 'chain-1' : 'shared-1', target: 'blend-1', targetHandle: 'with' },
      { source: 'blend-1', target: 'ramp-1', targetHandle: 'in' },
      { source: 'ramp-1', target: 'output-1', targetHandle: 'in' },
    ],
  };
}

describe('emitComponentSource on the starter graph', () => {
  it('emits a parsing component with a prop per slider dial', () => {
    expect(source).toContain('export function GeneratedShader');
    expect(source).toContain('gradientAngle = 45');
    expect(source).toContain('noiseScale = 3');
    expect(source).toContain('noiseSpeed = 0.15');
    expect(source).toContain('warpAmount = 0.35');
    expect(source).toContain('blendAmount = 0.5');
    expectParses(source);
  });

  it('shares one noise helper across the fan-out', () => {
    // Noise feeds Warp's driver AND Blend's overlay: one helper declaration,
    // referenced from both places.
    expect((source.match(/const noiseField = /g) ?? []).length).toBe(1);
    expect(source).toContain('noiseField(p).sub(0.5)');
    expect(source).toContain('noiseField(p);');
  });

  it('animates speed through useAnimatableSpeed, outside the effect deps', () => {
    // The generated component is a fixed graph, so hooks are callable — one
    // per speed dial, placed before the effect.
    expect(source).toContain("from '@mattermix/shaders-react'");
    expect(source).toContain('const noiseSpeedPhase = useAnimatableSpeed(noiseSpeed);');
    // The phase uniform absorbs speed changes, so the speed prop must NOT
    // rebuild the material: it stays out of the deps array.
    const deps = source.slice(source.lastIndexOf('}, ['));

    expect(deps).not.toContain('noiseSpeed');
    // Every other slider prop still rebuilds (spike-era shorthand, see the
    // emitted comment): scale is in deps.
    expect(deps).toContain('noiseScale');
  });

  it('has no speed uniform line — the hook owns the speed value', () => {
    expect(source).not.toContain('noiseSpeedUniform');
  });

  it('bakes ramp stops as literals, not props', () => {
    expect(source).toContain("{ position: 0, color: vec3(...parseColorString('#1B2A6B')) }");
    expect(source).toContain("{ position: 0.5, color: vec3(...parseColorString('#7C3AED')) }");
    expect(source).toContain("{ position: 1, color: vec3(...parseColorString('#F472B6')) }");
    expect(source).not.toContain('stops?:');
    expect(source).toContain("from '@mattermix/shaders/color'");
  });

  it('routes the ramp color into the material', () => {
    expect(source).toContain("'oklab'");
    expect(source).toContain('material.colorNode = rampColor;');
  });

  it('says it was generated by the editor', () => {
    expect(source).toContain('Generated by the Shaders editor');
  });
});

describe('generate cards', () => {
  it('fractal noise bakes the selected style fold and remap', () => {
    const { nodes, edges } = generatorGraph('fractalNoise');
    const clouds = emitComponentSource(nodes, edges, 'output-1');

    expect(clouds).toContain('fractalNoise(');
    // Style 'clouds' (the default): fold none, remap 0.5/0.5 — baked as
    // literals, with no style prop.
    expect(clouds).toContain("fold: 'none'");
    expect(clouds).toContain('octaves: 5');
    expect(clouds).not.toContain('style?:');
    expectParses(clouds);

    const smokeNodes = nodes.map((candidate) =>
      candidate.id === 'gen-1'
        ? { ...candidate, params: { ...candidate.params, style: 'smoke' } }
        : candidate,
    );
    const smoke = emitComponentSource(smokeNodes, edges, 'output-1');

    expect(smoke).toContain("fold: 'smooth'");
    expect(smoke).not.toContain("fold: 'none'");
  });

  it('voronoi emits the hash/edge blend with every dial as a prop', () => {
    const { nodes, edges } = generatorGraph('voronoi');
    const emitted = emitComponentSource(nodes, edges, 'output-1');

    expect(emitted).toContain('voronoiCells(');
    expect(emitted).toContain('jitter: voronoiIrregularityUniform');
    expect(emitted).toContain('drift: voronoiDriftUniform');
    expect(emitted).toContain('voronoiDrift = 0.6');
    expect(emitted).toContain('.edgeDistance.mul(2.5)');
    expect(emitted).toContain('mix(cells.hash, borderDepth, voronoiShadingUniform)');
    expectParses(emitted);
  });

  it('blobs emits the feathered goo edge around the centered field', () => {
    const { nodes, edges } = generatorGraph('blobs');
    const emitted = emitComponentSource(nodes, edges, 'output-1');

    expect(emitted).toContain('metaballs(p.sub(vec2(blobsCenterXUniform, blobsCenterYUniform))');
    expect(emitted).toContain('sizeVariation: blobsSizeVariationUniform');
    expect(emitted).toContain('spread: blobsSpreadUniform');
    expect(emitted).toContain('fwidth(field).add(blobsSoftnessUniform.mul(0.35))');
    expect(emitted).toContain('smoothstep(float(0.4).sub(band), float(0.4).add(band), field)');
    expectParses(emitted);
  });
});

describe('adjust cards', () => {
  it('tone bends OKLab lightness, not raw RGB', () => {
    const { nodes, edges } = adjustGraph('tone');
    const emitted = emitComponentSource(nodes, edges, 'output-1');

    expect(emitted).toContain('colorSpaces.oklab.fromLinear(');
    expect(emitted).toContain('colorSpaces.oklab.toLinear(');
    expect(emitted).toContain('exp2(toneBendUniform.mul(-2))');
    expectParses(emitted);
  });

  it('levels emits black/white/gamma over lightness', () => {
    const { nodes, edges } = adjustGraph('levels');
    const emitted = emitComponentSource(nodes, edges, 'output-1');

    expect(emitted).toContain('levelsBlack = 0');
    expect(emitted).toContain('levelsWhite = 1');
    expect(emitted).toContain('levelsGamma = 1');
    expect(emitted).toContain('max(sub(levelsWhiteUniform, levelsBlackUniform), 1e-4)');
    expect(emitted).toContain('float(1).div(levelsGammaUniform)');
    expectParses(emitted);
  });

  it('vignette emits the aspect-corrected distance ramp mixed toward the tint', () => {
    const { nodes, edges } = adjustGraph('vignette');
    const emitted = emitComponentSource(nodes, edges, 'output-1');

    expect(emitted).toContain('screenSize.x.div(screenSize.y)');
    expect(emitted).toContain('smoothstep(');
    // The center pair rides two number props; the tint is a string prop
    // decoded through parseColorString; the blend is oklab mixColor scaled
    // by strength.
    expect(emitted).toContain(
      'vignetteCenter = vec2(vignetteCenterXUniform, vignetteCenterYUniform)',
    );
    expect(emitted).toContain('vignetteColor?: string;');
    expect(emitted).toContain("vignetteColor = 'oklch(0 0 0)'");
    expect(emitted).toContain('vec3(...parseColorString(vignetteColor))');
    expect(emitted).toContain('mixColor(vec3(');
    expect(emitted).toContain("vignetteMask.mul(vignetteStrengthUniform), 'oklab')");
    expectParses(emitted);
  });

  it('grain re-rolls through the quantized phase and bakes the blend', () => {
    const { nodes, edges } = adjustGraph('grain');
    const emitted = emitComponentSource(nodes, edges, 'output-1');

    expect(emitted).toContain('grain(grainAmountUniform, floor(grainSpeedPhase.mul(60)))');
    expect(emitted).toContain('add(vec3(');
    expectParses(emitted);
  });

  it('grain bakes the subtractive branch when the select says so', () => {
    const { nodes, edges } = adjustGraph('grain');
    const subtractiveNodes = nodes.map((candidate) =>
      candidate.spec === 'grain'
        ? { ...candidate, params: { ...candidate.params, blend: 'subtractive' } }
        : candidate,
    );
    const emitted = emitComponentSource(subtractiveNodes, edges, 'output-1');

    expect(emitted).toContain('.abs()');
    expect(emitted).toContain('sub(vec3(');
    expectParses(emitted);
  });
});

describe('structure', () => {
  it('emits valid syntax for a dial-free graph, with no props interface', () => {
    const dialFree = emitComponentSource(
      [node('ramp-1', 'colorRamp'), node('output-1', 'output')],
      [{ source: 'ramp-1', target: 'output-1', targetHandle: 'in' }],
      'output-1',
    );

    expect(dialFree).toContain('export function GeneratedShader() {');
    expect(dialFree).not.toContain('GeneratedShaderProps');
    expectParses(dialFree);
  });

  it('promotes a bare field wired into Output to grayscale', () => {
    // The Output-only exception: a field straight into Output renders as its
    // grayscale image, vec3-broadcast at the output seam.
    const emitted = emitComponentSource(
      [node('gradient-1', 'gradient'), node('output-1', 'output')],
      [{ source: 'gradient-1', target: 'output-1', targetHandle: 'in' }],
      'output-1',
    );

    expect(emitted).toContain('material.colorNode = vec3(gradientField(uv()));');
    expectParses(emitted);
  });

  it('emits every warp when driver nesting sits at the cap', () => {
    const { nodes, edges } = warpChainGraph(MAX_WARP_DRIVER_DEPTH);
    const chain = emitComponentSource(nodes, edges, 'output-1');

    expect((chain.match(/Domain warp:/g) ?? []).length).toBe(MAX_WARP_DRIVER_DEPTH);
    expect(chain).toContain('noiseField');
    expectParses(chain);
  });

  it('passes warps through past the driver-depth cap, like the editor', () => {
    const { nodes, edges } = warpChainGraph(MAX_WARP_DRIVER_DEPTH + 2);
    const chain = emitComponentSource(nodes, edges, 'output-1');

    expect((chain.match(/Domain warp:/g) ?? []).length).toBe(MAX_WARP_DRIVER_DEPTH);
    expect(chain).toContain(`warp${MAX_WARP_DRIVER_DEPTH}Amount`);
    expect(chain).not.toContain(`warp${MAX_WARP_DRIVER_DEPTH + 1}Amount`);
    expect(chain).not.toContain('noiseField');
    expectParses(chain);
  });

  it('caps a shared warp reference at depth even when it already emitted shallow', () => {
    const { nodes, edges } = sharedWarpFanOutGraph(true);
    const emitted = emitComponentSource(nodes, edges, 'output-1');

    expect((emitted.match(/Domain warp:/g) ?? []).length).toBe(MAX_WARP_DRIVER_DEPTH + 1);
    expect(emitted).toContain('const pushX = gradientField(p).sub(0.5);');
    expect(emitted).not.toContain('const pushX = warpField(p).sub(0.5);');
    expectParses(emitted);
  });

  it('emits the real warp shallow even when the same warp already capped deep', () => {
    const { nodes, edges } = sharedWarpFanOutGraph(false);
    const emitted = emitComponentSource(nodes, edges, 'output-1');

    expect((emitted.match(/Domain warp:/g) ?? []).length).toBe(MAX_WARP_DRIVER_DEPTH + 1);
    expect(emitted).toContain('const pushX = noiseField(p).sub(0.5);');
    expect(emitted).toContain('const pushX = gradientField(p).sub(0.5);');
    expectParses(emitted);
  });

  it('shares one prop per dial when a warp helper forks across depths', () => {
    const emitted = emitComponentSource(
      [
        node('gradient-1', 'gradient'),
        node('noise-1', 'noise'),
        node('shared-1', 'warp'),
        node('outer-1', 'warp'),
        node('blend-1', 'blend'),
        node('ramp-1', 'colorRamp'),
        node('output-1', 'output'),
      ],
      [
        { source: 'gradient-1', target: 'shared-1', targetHandle: 'source' },
        { source: 'noise-1', target: 'shared-1', targetHandle: 'by' },
        { source: 'gradient-1', target: 'outer-1', targetHandle: 'source' },
        { source: 'shared-1', target: 'outer-1', targetHandle: 'by' },
        { source: 'shared-1', target: 'blend-1', targetHandle: 'in' },
        { source: 'outer-1', target: 'blend-1', targetHandle: 'with' },
        { source: 'blend-1', target: 'ramp-1', targetHandle: 'in' },
        { source: 'ramp-1', target: 'output-1', targetHandle: 'in' },
      ],
      'output-1',
    );

    expect(emitted).toContain('warpAmount = 0.35');
    expect(emitted).not.toContain('warp2Amount');
    expect(emitted).toContain('warp3Amount = 0.35');
    expect((emitted.match(/warpAmountUniform/g) ?? []).length).toBe(3);
    expectParses(emitted);
  });
});

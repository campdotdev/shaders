// Tests the code emitter against the demo graph, and keeps the committed
// generated/scene.gen.tsx honest: the /dev/editor-probe/generated route
// renders that file for the side-by-side check against the editor's Output
// card, and the golden-file test fails if it drifts from what the emitter
// produces today. After an intentional emitter change, refresh it with
// `REFRESH_GENERATED=1 pnpm --filter docs test`.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import type { GraphEdge, GraphNode } from './compile';
import { DEMO_EDGES, DEMO_NODES } from './demo-graph';
import { emitComponentSource } from './emit';
import { defaultParamsOf, MAX_WARP_DRIVER_DEPTH } from './registry';
import type { SpecId } from './registry';

const graphNodes = DEMO_NODES.map(({ id, spec }) => ({
  id,
  spec,
  params: defaultParamsOf(spec),
}));

const source = emitComponentSource(graphNodes, DEMO_EDGES, 'output-1');

function node(id: string, spec: SpecId): GraphNode {
  return { id, spec, params: defaultParamsOf(spec) };
}

/** Fails when TypeScript's parser reports syntax errors in emitted code. */
function expectParses(code: string) {
  const result = ts.transpileModule(code, { reportDiagnostics: true });

  expect(result.diagnostics ?? []).toEqual([]);
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

describe('emitComponentSource', () => {
  it('emits a component with a prop per slider dial', () => {
    expect(source).toContain('export function GeneratedShader');
    // Demo graph dials: gradient angle, noise scale + speed, warp amount.
    expect(source).toContain('gradientAngle = 45');
    expect(source).toContain('noiseScale = 3');
    expect(source).toContain('noiseSpeed = 0.15');
    expect(source).toContain('warpAmount = 0.35');
  });

  it('emits fields as functions of the sample position', () => {
    expect(source).toContain('const noiseField = (p: TSLNode) =>');
    // Warp calls the driver twice (decorrelated taps) and the source once,
    // all through the shared helper names — fan-out as plain code reuse.
    expect(source).toContain('noiseField(p).sub(0.5)');
    expect(source).toContain('gradientField(displace(p,');
  });

  it('routes the ramp color into the material', () => {
    expect(source).toContain("colorRamp(warpField(uv()), rampStops, 'oklab')");
    expect(source).toContain('material.colorNode = rampColor;');
  });

  it('imports CPU color parsing from the three-free door', () => {
    expect(source).toContain("from '@lovo/matter/color'");
  });

  it('emits valid syntax for a dial-free graph', () => {
    // Ramp straight into Output: no sliders anywhere, so no props — the
    // component signature must drop the destructuring and interface rather
    // than emit `{ , }`.
    const dialFree = emitComponentSource(
      [node('ramp-1', 'colorRamp'), node('output-1', 'output')],
      [{ source: 'ramp-1', target: 'output-1', targetHandle: 'in' }],
      'output-1',
    );

    expect(dialFree).toContain('export function GeneratedShader() {');
    expect(dialFree).not.toContain('GeneratedShaderProps');
    expectParses(dialFree);
  });

  it('emits every warp when driver nesting sits at the cap', () => {
    const { nodes, edges } = warpChainGraph(MAX_WARP_DRIVER_DEPTH);
    const chain = emitComponentSource(nodes, edges, 'output-1');

    expect((chain.match(/Domain warp:/g) ?? []).length).toBe(MAX_WARP_DRIVER_DEPTH);
    // The deepest driver (noise) is still reachable.
    expect(chain).toContain('noiseField');
    expectParses(chain);
  });

  it('passes warps through past the driver-depth cap, like the editor', () => {
    const { nodes, edges } = warpChainGraph(MAX_WARP_DRIVER_DEPTH + 2);
    const chain = emitComponentSource(nodes, edges, 'output-1');

    // Only the first MAX warps emit driver logic; the capped warp passes its
    // source through, so the chain never reaches the noise at the far end.
    expect((chain.match(/Domain warp:/g) ?? []).length).toBe(MAX_WARP_DRIVER_DEPTH);
    expect(chain).toContain(`warp${MAX_WARP_DRIVER_DEPTH}Amount`);
    expect(chain).not.toContain(`warp${MAX_WARP_DRIVER_DEPTH + 1}Amount`);
    expect(chain).not.toContain('noiseField');
    expectParses(chain);
  });

  it('caps a shared warp reference at depth even when it already emitted shallow', () => {
    // Shallow reference walks first and caches the real warp; the capped
    // reference must NOT reuse it — the editor passes through there.
    const { nodes, edges } = sharedWarpFanOutGraph(true);
    const emitted = emitComponentSource(nodes, edges, 'output-1');

    // Real warps: the shared one plus the four chain warps.
    expect((emitted.match(/Domain warp:/g) ?? []).length).toBe(MAX_WARP_DRIVER_DEPTH + 1);
    // The capped driver reads the shared warp's SOURCE (gradient), not the
    // cached real warp helper (warpField, first claim in this order).
    expect(emitted).toContain('const pushX = gradientField(p).sub(0.5);');
    expect(emitted).not.toContain('const pushX = warpField(p).sub(0.5);');
    expectParses(emitted);
  });

  it('emits the real warp shallow even when the same warp already capped deep', () => {
    // Capped reference walks first; the shallow reference must still emit the
    // full warp instead of inheriting the pass-through.
    const { nodes, edges } = sharedWarpFanOutGraph(false);
    const emitted = emitComponentSource(nodes, edges, 'output-1');

    expect((emitted.match(/Domain warp:/g) ?? []).length).toBe(MAX_WARP_DRIVER_DEPTH + 1);
    // Shallow reference emits the real warp (driver taps of its noise)...
    expect(emitted).toContain('const pushX = noiseField(p).sub(0.5);');
    // ...while the capped reference passed through to the gradient.
    expect(emitted).toContain('const pushX = gradientField(p).sub(0.5);');
    expectParses(emitted);
  });

  it('shares one prop per dial when a warp helper forks across depths', () => {
    // shared-1 is referenced at depth 0 (blend in) and depth 1 (outer warp's
    // driver): the helper forks per depth, but both variants must ride the
    // same amount prop and uniform.
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

    // Claims in walk order: shared-1 at depth 0 -> warp, shared-1 re-emitted
    // at depth 1 -> warp2 (amount deduped, so no warp2Amount prop), outer-1
    // -> warp3 with its own dial.
    expect(emitted).toContain('warpAmount = 0.35');
    expect(emitted).not.toContain('warp2Amount');
    expect(emitted).toContain('warp3Amount = 0.35');
    // Both shared-warp variants ride the one uniform: its declaration plus
    // the push scale in each helper body.
    expect((emitted.match(/warpAmountUniform/g) ?? []).length).toBe(3);
    expectParses(emitted);
  });

  it('matches the committed generated preview scene', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const target = join(here, 'generated', 'scene.gen.tsx');

    if (process.env.REFRESH_GENERATED === '1') {
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, source);
    }
    expect(readFileSync(target, 'utf8')).toBe(source);
  });
});

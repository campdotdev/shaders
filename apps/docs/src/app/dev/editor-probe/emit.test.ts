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

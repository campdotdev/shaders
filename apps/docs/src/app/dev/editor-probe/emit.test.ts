// Tests the code emitter against the demo graph — and doubles as the
// generation script: every run writes generated/scene.gen.tsx, which the
// /dev/editor-probe/generated route renders for the side-by-side check
// against the editor's Output card. Refresh it with `pnpm --filter docs test`.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { DEMO_EDGES, DEMO_NODES } from './demo-graph';
import { emitComponentSource } from './emit';
import { defaultParamsOf } from './registry';

const graphNodes = DEMO_NODES.map(({ id, spec }) => ({
  id,
  spec,
  params: defaultParamsOf(spec),
}));

const source = emitComponentSource(graphNodes, DEMO_EDGES, 'output-1');

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

  it('writes the generated preview scene', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const target = join(here, 'generated', 'scene.gen.tsx');

    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, source);
    expect(source.length).toBeGreaterThan(500);
  });
});

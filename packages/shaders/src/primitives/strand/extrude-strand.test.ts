import { type ShaderNodeObject, sin, uniform, vec3 } from 'three/tsl';
import type { Node } from 'three/webgpu';
import { describe, expect, it, vi } from 'vitest';

import { extrudeStrand } from './extrude-strand.js';

type TSLValue = ShaderNodeObject<Node>;

const wave = (along: TSLValue, across: TSLValue) => vec3(along, sin(along).add(across), 0);

describe('extrudeStrand', () => {
  it('returns position and distance nodes', () => {
    const strand = extrudeStrand(wave, { strandWidth: 4 });

    expect(strand.position).toBeDefined();
    expect(strand.distance).toBeDefined();
  });

  it('accepts a numeric and a node strandWidth', () => {
    const numeric = extrudeStrand(wave, { strandWidth: 4 });
    const node = extrudeStrand(wave, { strandWidth: uniform(4) });

    expect(numeric.position).toBeDefined();
    expect(node.position).toBeDefined();
  });

  // The tangent comes from the points just before and just after the vertex,
  // and the vertex sits on the point between them.
  it('evaluates the path at three points along the strand', () => {
    const path = vi.fn(wave);

    extrudeStrand(path, { strandWidth: 4 });

    expect(path).toHaveBeenCalledTimes(3);
  });

  it('hands the path along, across, and seed', () => {
    const path = vi.fn((along: TSLValue, across: TSLValue, seed: TSLValue) =>
      vec3(along, across, seed),
    );

    extrudeStrand(path, { strandWidth: 4 });

    const [along, across, seed] = path.mock.calls[0]!;

    expect(typeof along.add).toBe('function');
    expect(typeof across.add).toBe('function');
    expect(typeof seed.add).toBe('function');
  });

  it('returns chainable nodes', () => {
    const { position, distance } = extrudeStrand(wave, { strandWidth: 4 });

    expect(typeof position.add).toBe('function');
    expect(typeof distance.abs).toBe('function');
  });
});

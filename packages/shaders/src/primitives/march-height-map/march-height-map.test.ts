import { type ShaderNodeObject, sin, uniform, uv, vec3 } from 'three/tsl';
import type { Node } from 'three/webgpu';
import { describe, expect, it } from 'vitest';

import { cameraRay } from '../camera-ray/camera-ray.js';
import { marchHeightMap } from './march-height-map.js';

const flat = () => uniform(0);
const rolling = (point: ShaderNodeObject<Node>) => sin(point.x).mul(sin(point.y)).mul(0.5);

describe('marchHeightMap', () => {
  it('returns hit, distance, position, and normal nodes', () => {
    const march = marchHeightMap(cameraRay(uv(), { altitude: 1, tilt: 10 }), rolling, {
      steps: 32,
    });

    expect(march.hit).toBeDefined();
    expect(march.distance).toBeDefined();
    expect(march.position).toBeDefined();
    expect(march.normal).toBeDefined();
  });

  it('accepts a ray built by hand', () => {
    const march = marchHeightMap(
      { origin: vec3(0, 1, 0), direction: vec3(0, -0.2, 1).normalize() },
      flat,
      { steps: 8 },
    );

    expect(march.hit).toBeDefined();
  });

  it('accepts numeric and node options', () => {
    const numeric = marchHeightMap(cameraRay(uv()), rolling, {
      steps: 16,
      maxDistance: 50,
      stepScale: 0.5,
      normalOffset: 0.01,
    });
    const nodes = marchHeightMap(cameraRay(uv()), rolling, {
      steps: 16,
      maxDistance: uniform(50),
      stepScale: uniform(0.5),
      normalOffset: uniform(0.01),
    });

    expect(numeric.normal).toBeDefined();
    expect(nodes.normal).toBeDefined();
  });

  // The step count becomes a literal loop bound in the shader. WebGL2 needs
  // it to be a whole number fixed at build time, so anything else throws
  // here instead of failing to compile on the GPU.
  it.each([0, -4, 2.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'throws on a step count of %s',
    (steps) => {
      expect(() => marchHeightMap(cameraRay(uv()), rolling, { steps })).toThrow(RangeError);
    },
  );

  it('returns chainable nodes', () => {
    const { hit, distance, position, normal } = marchHeightMap(cameraRay(uv()), rolling, {
      steps: 8,
    });

    expect(typeof hit.mul).toBe('function');
    expect(typeof distance.mul).toBe('function');
    expect(typeof position.add).toBe('function');
    expect(typeof normal.dot).toBe('function');
  });
});

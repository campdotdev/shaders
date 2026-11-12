import { uniform, uv } from 'three/tsl';
import { describe, expect, it } from 'vitest';

import { cameraRay } from './camera-ray.js';

describe('cameraRay', () => {
  it('returns an origin and a direction with default options', () => {
    const ray = cameraRay(uv());

    expect(ray.origin).toBeDefined();
    expect(ray.direction).toBeDefined();
  });

  it('accepts numeric options', () => {
    const ray = cameraRay(uv(), {
      aspect: 16 / 9,
      altitude: 2,
      tilt: 10,
      fieldOfView: 50,
      turn: { right: 5, up: -3 },
    });

    expect(ray.direction).toBeDefined();
  });

  it('accepts node options (uniform-driven dials)', () => {
    const ray = cameraRay(uv(), {
      aspect: uniform(2),
      altitude: uniform(1.5),
      tilt: uniform(12),
      fieldOfView: uniform(60),
      turn: { right: uniform(0), up: uniform(0) },
    });

    expect(ray.origin).toBeDefined();
    expect(ray.direction).toBeDefined();
  });

  it('accepts a turn with only one axis', () => {
    expect(cameraRay(uv(), { turn: { right: 10 } }).direction).toBeDefined();
    expect(cameraRay(uv(), { turn: { up: 10 } }).direction).toBeDefined();
  });

  it('returns chainable nodes', () => {
    const { origin, direction } = cameraRay(uv());

    expect(typeof origin.add).toBe('function');
    expect(typeof direction.mul).toBe('function');
  });
});

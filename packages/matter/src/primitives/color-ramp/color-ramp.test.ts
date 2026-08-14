import { uniform, uv, vec3 } from 'three/tsl';
import { describe, expect, it } from 'vitest';

import { colorRamp } from './color-ramp.js';

const stops = [
  { color: vec3(1, 0, 0), position: 0 },
  { color: vec3(0, 0, 1), position: 1 },
];

describe('colorRamp colorSpace', () => {
  it('builds with the default (linear) space', () => {
    expect(colorRamp(uv().x, stops)).toBeDefined();
  });

  it('builds for oklab and oklch', () => {
    expect(colorRamp(uv().x, stops, 'oklab')).toBeDefined();
    expect(colorRamp(uv().x, stops, 'oklch')).toBeDefined();
  });
});

describe('colorRamp node-driven stops', () => {
  it('builds when positions are uniforms', () => {
    const nodeStops = [
      { color: vec3(1, 0, 0), position: uniform(0) },
      { color: vec3(0, 1, 0), position: uniform(0.5) },
      { color: vec3(0, 0, 1), position: uniform(1) },
    ];

    expect(colorRamp(uv().x, nodeStops)).toBeDefined();
    expect(colorRamp(uv().x, nodeStops, 'oklab')).toBeDefined();
    expect(colorRamp(uv().x, nodeStops, 'oklch')).toBeDefined();
  });

  it('builds when colors are node-valued (uniform channels)', () => {
    const nodeColorStops = [
      { color: vec3(uniform(1), uniform(0), uniform(0)), position: 0 },
      { color: vec3(uniform(0), uniform(0), uniform(1)), position: 1 },
    ];

    expect(colorRamp(uv().x, nodeColorStops, 'oklab')).toBeDefined();
  });

  it('builds when literal and node positions mix', () => {
    const mixedStops = [
      { color: vec3(1, 0, 0), position: 0 },
      { color: vec3(0, 0, 1), position: uniform(0.6) },
      { color: vec3(1, 1, 1), position: 1 },
    ];

    expect(colorRamp(uv().x, mixedStops)).toBeDefined();
  });
});

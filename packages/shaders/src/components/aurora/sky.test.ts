// Unit tests for the CPU half of Aurora's field pass: the patch of the sky
// plane the march reaches, and the texture size that covers it. What the
// field looks like is the visual spec's job
// (apps/docs-tests/visual/aurora.spec.ts).
import { describe, expect, it } from 'vitest';

import { fieldTextureSize, skyPatch } from './sky.js';

// ----------------------------------------------------------------------------
// The march, restated from the shader
// ----------------------------------------------------------------------------
// Where the shader samples step `stepIndex` of the pixel at (u, v), 0..1 from
// the canvas's bottom-left, as [x, z] on the sky plane. The numbers are the
// shader's, written out so a change to its geometry has to come through
// here. `jitter` is the per-pixel nudge the shader subtracts from the
// distance, 0 up to 0.006 once the jitter has ramped in.
function shaderSample(u: number, v: number, aspect: number, stepIndex: number, jitter: number) {
  const rayX = (u - 0.5) * 2 * aspect;
  const rayY = v * 1.03 - 0.03;
  const length = Math.hypot(rayX, rayY, 1.064);
  const [directionX, directionY, directionZ] = [rayX / length, rayY / length, 1.064 / length];
  const rampedJitter = jitter * smoothstep(0, 15, stepIndex);
  const distance = (stepIndex ** 1.4 * 0.002 + 0.8) / (directionY * 2 + 0.4) - rampedJitter;

  return [5.5 + directionX * distance, 5.5 + directionZ * distance] as const;
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const t = Math.min(Math.max((value - edge0) / (edge1 - edge0), 0), 1);

  return t * t * (3 - 2 * t);
}

/** Every sample of a grid of pixels across the canvas, edges included, at both jitter extremes. */
function samplesAcross(aspect: number) {
  const samples: Array<readonly [number, number]> = [];
  const steps = 24;

  for (let column = 0; column <= steps; column += 1) {
    for (let row = 0; row <= steps; row += 1) {
      for (let stepIndex = 0; stepIndex < 60; stepIndex += 1) {
        for (const jitter of [0, 0.006]) {
          samples.push(shaderSample(column / steps, row / steps, aspect, stepIndex, jitter));
        }
      }
    }
  }

  return samples;
}

// From a tall phone canvas to the Components banner's 12:1 strip.
const ASPECTS = [0.5, 1, 1636 / 696, 4, 12];

describe('skyPatch', () => {
  // The field texture covers the patch and clamps past its edge, so a sample
  // outside it would read the edge texel instead of the field.
  it.each(ASPECTS)('holds every sample of every pixel at aspect %d', (aspect) => {
    const { minX, maxX, minZ, maxZ } = skyPatch(aspect);
    const outside = samplesAcross(aspect).filter(
      ([x, z]) => x < minX || x > maxX || z < minZ || z > maxZ,
    );

    expect(outside).toEqual([]);
  });

  // Every texel outside the samples' reach is drawn each frame for nothing,
  // and spreads the rest thinner.
  it.each(ASPECTS)('reaches no further than the samples do at aspect %d', (aspect) => {
    const { minX, maxX, minZ, maxZ } = skyPatch(aspect);
    const samples = samplesAcross(aspect);
    const spanX = maxX - minX;
    const spanZ = maxZ - minZ;
    const nearest = (distanceFromEdge: (sample: readonly [number, number]) => number) =>
      Math.min(...samples.map(distanceFromEdge));

    expect(nearest(([x]) => x - minX)).toBeLessThan(spanX * 0.01);
    expect(nearest(([x]) => maxX - x)).toBeLessThan(spanX * 0.01);
    expect(nearest(([, z]) => z - minZ)).toBeLessThan(spanZ * 0.01);
    expect(nearest(([, z]) => maxZ - z)).toBeLessThan(spanZ * 0.01);
  });
});

describe('fieldTextureSize', () => {
  // The homepage hero's patch, at its pinned size at 2x.
  const patch = skyPatch(1636 / 696);
  const spanX = patch.maxX - patch.minX;
  const spanZ = patch.maxZ - patch.minZ;

  it('gives the texture about as many texels as the canvas has pixels at density 1', () => {
    const { width, height } = fieldTextureSize(patch, 3272, 1392, 1);

    expect((width * height) / (3272 * 1392)).toBeCloseTo(1, 2);
  });

  // A texel then covers the same distance across the sky as toward the
  // horizon, so the filter blurs the field the same amount both ways.
  it('makes texels square on the sky plane', () => {
    const { width, height } = fieldTextureSize(patch, 3272, 1392, 1);

    expect(spanX / width / (spanZ / height)).toBeCloseTo(1, 2);
  });

  it('draws a quarter of the texels at half density', () => {
    const full = fieldTextureSize(patch, 3272, 1392, 1);
    const half = fieldTextureSize(patch, 3272, 1392, 0.5);

    expect((half.width * half.height) / (full.width * full.height)).toBeCloseTo(0.25, 2);
  });

  // Past 4096 texels a side, some WebGL2 devices cannot allocate the
  // texture. A collapsed canvas still gets a real one-texel texture.
  it('keeps each side between 1 and 4096 texels', () => {
    const huge = fieldTextureSize(patch, 12000, 5000, 1);
    const collapsed = fieldTextureSize(patch, 0, 0, 1);

    expect(huge.width).toBe(4096);
    expect(huge.height).toBeLessThanOrEqual(4096);
    expect(collapsed).toEqual({ width: 1, height: 1 });
  });
});

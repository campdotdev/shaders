'use client';

import { useEffect } from 'react';

import { elapsedTime, type TSLNode } from '@lovo/matter';
import { useShaderContext } from '@lovo/matter-react';
import {
  cos,
  float,
  Fn,
  fract,
  type ShaderNodeObject,
  sin,
  uv,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import { Mesh, MeshBasicNodeMaterial, type Node, PlaneGeometry } from 'three/webgpu';

// Aurora technique inspired by nimitz's "Auroras" (shadertoy.com/view/XtGGRt):
// triangle-noise fbm, depth-sliced raymarch, average-then-accumulate
// compositing. Original TSL implementation, constants tuned at the MAT-48
// gates.

type TSLValue = ShaderNodeObject<Node>;

/**
 * Triangle wave of x in [0, 0.5]. Where simplex is billowy, the triangle wave
 * has straight slopes and sharp creases — the creases become the curtain
 * filaments.
 */
const triangleWave = (value: TSLNode): TSLValue => fract(value).sub(0.5).abs();

/** Cross-fed vec2 triangle wave; nesting x into y decorrelates the axes. */
const triangleWave2 = (point: TSLValue): TSLValue =>
  vec2(
    triangleWave(point.x).add(triangleWave(point.y)),
    triangleWave(point.y.add(triangleWave(point.x))),
  );

/** Rotate a vec2 by an angle without mat2 — keeps everything a plain chain. */
const rotate2d = (point: TSLValue, angle: TSLNode): TSLValue =>
  vec2(
    point.x.mul(cos(angle)).sub(point.y.mul(sin(angle))),
    point.x.mul(sin(angle)).add(point.y.mul(cos(angle))),
  );

/**
 * Five-octave triangle-noise fbm. Each octave warps the domain with a
 * time-rotated triangle-wave offset (the shimmer), climbs a lacunarity/gain
 * ladder, accumulates a ridge term, and rotates the whole domain a little
 * (`domainPhase` — slow continuous evolution). Reciprocal-power shaping
 * concentrates brightness into thin filaments.
 */
const auroraField = (coords: TSLValue, warpPhase: TSLNode, domainPhase: TSLNode): TSLValue => {
  let ridgeGain = 1.8;
  let warpGain = 2.5;
  let ridgeSum: TSLValue = float(0);
  let point = rotate2d(coords, coords.x.mul(0.06));
  let warpPoint = point;

  for (let octave = 0; octave < 5; octave += 1) {
    const warp = rotate2d(triangleWave2(warpPoint.mul(1.85)).mul(0.75), warpPhase);

    point = point.sub(warp.div(warpGain));

    warpPoint = warpPoint.mul(1.3);
    warpGain *= 0.45;
    ridgeGain *= 0.42;
    point = point.mul(ridgeSum.sub(1).mul(0.02).add(1.21));

    ridgeSum = ridgeSum.add(triangleWave(point.x.add(triangleWave(point.y))).mul(ridgeGain));
    point = rotate2d(point, domainPhase);
  }

  return float(1).div(ridgeSum.mul(20).pow(1.3)).clamp(0, 1);
};

export function AuroraShader() {
  const shaderContext = useShaderContext();

  useEffect(() => {
    const material = new MeshBasicNodeMaterial();

    // Phase 1 scaffolding: look straight at the field, grayscale, no march.
    // uv is stretched to roughly the coordinate range the raymarch will
    // sample so this gate judges the real pattern.
    const fieldPreview = Fn(() => {
      const coords = uv().sub(0.5).mul(vec2(10, 4));
      const warpPhase = elapsedTime.mul(0.02);
      const domainPhase = elapsedTime.mul(0.01);
      const fieldValue = auroraField(coords, warpPhase, domainPhase);

      return vec4(vec3(fieldValue), 1);
    })();

    material.colorNode = fieldPreview;

    const mesh = new Mesh(new PlaneGeometry(2, 2), material);

    shaderContext?.scene.add(mesh);

    return () => {
      shaderContext?.scene.remove(mesh);
      try {
        material.dispose();
      } catch {
        // three/webgpu can throw during dispose under Strict Mode double-invoke
      }
    };
  }, [shaderContext]);

  return null;
}

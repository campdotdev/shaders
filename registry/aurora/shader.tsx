'use client';

import { useEffect, useMemo } from 'react';

import {
  colorRamp,
  type ColorSpace,
  elapsedTime,
  type HueInterpolation,
  type TSLNode,
} from '@lovo/matter';
import { useResize, useShaderContext } from '@lovo/matter-react';
import {
  clamp,
  cos,
  dot,
  exp2,
  float,
  Fn,
  fract,
  Loop,
  mix,
  normalize,
  screenCoordinate,
  type ShaderNodeObject,
  sin,
  smoothstep,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import { Mesh, MeshBasicNodeMaterial, type Node, PlaneGeometry } from 'three/webgpu';

import { type ColorStop, colorStopsKey, toColorRampStops } from '../utils/color';

// Aurora technique inspired by nimitz's "Auroras" (shadertoy.com/view/XtGGRt):
// triangle-noise fbm, depth-sliced raymarch, average-then-accumulate
// compositing. Original TSL implementation, constants tuned at the MAT-48
// gates.

type TSLValue = ShaderNodeObject<Node>;

/** Raymarch slice count. Banding re-judged at the Phase 2 gate. */
const STEP_COUNT = 60;

/** Per-pixel hash (fract-dot construction) — seeds the march jitter. */
const hashNoise = (point: TSLValue): TSLValue => {
  const spread = fract(vec3(point.x, point.y, point.x).mul(0.1031));
  const mixed = spread.add(dot(spread, vec3(spread.y, spread.z, spread.x).add(33.33)));

  return fract(mixed.x.add(mixed.y).mul(mixed.z));
};

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

export interface AuroraShaderProps {
  stops: ColorStop[];
  colorSpace: ColorSpace;
  hueInterpolation: HueInterpolation;
}

export function AuroraShader({ stops, colorSpace, hueInterpolation }: AuroraShaderProps) {
  const shaderContext = useShaderContext();
  const resize = useResize();

  // Stable string proxy for the stops array — colors/positions are baked
  // into the ramp as literals, so a content change must rebuild the
  // material, but an identity-only change must not (gotcha #17/#19).
  const stopsKey = colorStopsKey(stops);

  const [initialWidth, initialHeight] = resize.get();
  const aspectNode = useMemo(
    () => uniform(initialHeight > 0 ? initialWidth / initialHeight : 16 / 9),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    const [canvasWidth, canvasHeight] = resize.get();

    if (canvasWidth > 0 && canvasHeight > 0) aspectNode.value = canvasWidth / canvasHeight;

    return resize.on('change', ([updatedWidth, updatedHeight]) => {
      if (updatedWidth > 0 && updatedHeight > 0) aspectNode.value = updatedWidth / updatedHeight;
    });
  }, [resize, aspectNode]);

  useEffect(() => {
    const material = new MeshBasicNodeMaterial();
    const rampStops = toColorRampStops(stops);

    material.transparent = true;
    // rgb below is the accumulated curtain light itself (premultiplied);
    // alpha is coverage. Without this flag NormalBlending scales rgb by
    // alpha a second time and everything dims quadratically (MAT-45).
    material.premultipliedAlpha = true;

    const auroraNode = Fn(() => {
      // Screen uv → centered NDC; x carries the aspect so ribbons don't
      // stretch on wide canvases.
      const ndcX = uv().x.sub(0.5).mul(2).mul(aspectNode);
      const ndcY = uv().y.sub(0.5).mul(2);

      // Virtual camera looking toward the horizon (+z); z sets the fov.
      const rayDirection = normalize(vec3(ndcX, ndcY, 1.064));

      const warpPhase = elapsedTime.mul(0.02);
      const domainPhase = elapsedTime.mul(0.01);

      // Per-pixel jitter seed: decorrelates slice offsets pixel-to-pixel so
      // the discrete march dissolves into grain instead of contour banding.
      const jitterSeed = hashNoise(screenCoordinate.xy);

      // Loop state must be GPU-side variables (toVar) — the loop runs on the
      // GPU, so a JS binding can't change per iteration there.
      const accumulated = vec4(0).toVar();
      const runningAverage = vec4(0).toVar();

      Loop(STEP_COUNT, ({ i }: { i: TSLValue }) => {
        const stepIndex = float(i);

        // Ramp jitter in over the first slices — the lowest slices draw the
        // curtain's sharp bottom edge and shouldn't be blurred.
        const jitter = jitterSeed.mul(0.006).mul(smoothstep(0, 15, stepIndex));

        // pow(i, 1.4) packs slices tight at the base and spreads them with
        // height; the bent divisor fakes atmospheric curvature so
        // horizon-grazing rays push the sheet toward the horizon line.
        const marchDistance = stepIndex
          .pow(1.4)
          .mul(0.002)
          .add(0.8)
          .div(rayDirection.y.mul(2).add(0.4))
          .sub(jitter);

        const samplePoint = vec3(5.5).add(rayDirection.mul(marchDistance));

        // Sample the field on the horizontal plane: z runs toward the
        // horizon, x runs across the screen.
        const fieldValue = auroraField(
          vec2(samplePoint.z, samplePoint.x),
          warpPhase,
          domainPhase,
        );

        // Depth-stratified color: slice index drives the user ramp, so near
        // and far ribbons glow different stops. pow keeps the upper stops
        // visible — extinction weights early slices, so a linear index
        // would read as stop 0 almost everywhere.
        const sliceProgress = stepIndex.div(STEP_COUNT).pow(0.6);
        const sliceColor = colorRamp(sliceProgress, rampStops, colorSpace, hueInterpolation);

        const slice = vec4(sliceColor.mul(fieldValue), fieldValue);

        // Average-then-accumulate: blending each slice into a running
        // average before adding smears slice-to-slice noise into continuous
        // wisps.
        runningAverage.assign(mix(runningAverage, slice, 0.5));

        // Atmospheric extinction: each successive slice contributes
        // exponentially less; the smoothstep suppresses the first few
        // slices, which otherwise read as a hard floor.
        const extinction = exp2(stepIndex.mul(-0.065).sub(2.5));

        accumulated.addAssign(runningAverage.mul(extinction).mul(smoothstep(0, 5, stepIndex)));
      });

      // Rays pointing below the horizon never hit sky — fade them out fast.
      const horizonMask = clamp(rayDirection.y.mul(15).add(0.4), 0, 1);

      // Soft-clip shaping: lifts the mids and rolls off the top instead of
      // clipping hot filaments. Applies to the alpha channel too — coverage
      // rode through the same average/extinction pipeline in .a.
      const shaped = smoothstep(0, 1.1, accumulated.mul(horizonMask).mul(1.5));

      return vec4(shaped.rgb, shaped.a.clamp(0, 1));
    })();

    material.colorNode = auroraNode;

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
    // stopsKey stands in for stops (content proxy; rampStops derives from it).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shaderContext, stopsKey, colorSpace, hueInterpolation, aspectNode]);

  return null;
}

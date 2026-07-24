'use client';

import { useEffect, useMemo } from 'react';

import {
  colorRamp,
  type ColorSpace,
  elapsedTime,
  type HueInterpolation,
  type TSLNode,
} from '@lovo/matter';
import {
  type AnimatableProp,
  useAnimatableUniform,
  useResize,
  useShaderContext,
} from '@lovo/matter-react';
import {
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

// The aurora's GPU half. Unlike the flat 2D components, this one fakes a 3D
// scene: each pixel shoots a view ray toward a virtual horizon and marches
// along it in 60 steps (a "raymarch" — sampling a field at successive
// distances and accumulating what it hits). At every step it samples a
// layered noise field; where the noise creases, light accumulates, and the
// creases stack up into the curtain ribbons. Depth also picks the color:
// near slices take the ramp's first stops, far slices the last.
//
// Aurora technique inspired by nimitz's "Auroras" (shadertoy.com/view/XtGGRt):
// triangle-noise fbm, depth-sliced raymarch, average-then-accumulate
// compositing. Original TSL implementation. ("fbm" = fractal Brownian
// motion: the same noise stacked at several zoom levels — octaves — so big
// billows carry fine detail.)

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
const auroraField = (
  coords: TSLValue,
  warpPhase: TSLNode,
  domainPhase: TSLNode,
  warpStrength: TSLNode,
): TSLValue => {
  let ridgeGain = 1.8;
  let warpGain = 2.5;
  let ridgeSum: TSLValue = float(0);
  let point = rotate2d(coords, coords.x.mul(0.06));
  let warpPoint = point;

  for (let octave = 0; octave < 5; octave += 1) {
    const warp = rotate2d(
      triangleWave2(warpPoint.mul(1.85)).mul(0.75).mul(warpStrength),
      warpPhase,
    );

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
  /**
   * Curtain colors; nearer ribbons lean on earlier stops, farther ribbons on
   * later ones. Accepts hex, `oklch()`, or `oklab()`.
   */
  stops: ColorStop[];
  /**
   * Overall brightness. Feeds a soft-clip curve, so values past 1 saturate
   * gracefully instead of clipping. 0 hides the curtains.
   * Accepts a static value or an animation signal.
   */
  intensity: AnimatableProp<number>;
  /**
   * Animation rate of the curtain shimmer and drift. 0 freezes the motion.
   * Accepts a static value or an animation signal.
   */
  speed: AnimatableProp<number>;
  /**
   * How much the curtain filaments bend and billow. 0 gives straight,
   * unwarped ribbons; higher values make them wavier and more chaotic.
   * Accepts a static value or an animation signal.
   */
  waviness: AnimatableProp<number>;
  /**
   * How much of the canvas the aurora covers, revealed from the bottom up
   * along a soft fade line. 0 hides the aurora, 1 covers the canvas.
   * Accepts a static value or an animation signal.
   */
  coverage: AnimatableProp<number>;
  /** Color space the curtain colors are interpolated in. */
  colorSpace: ColorSpace;
  /**
   * Hue arc for cylindrical color spaces (oklch/lch/hsl/hsv); inert
   * otherwise.
   */
  hueInterpolation: HueInterpolation;
}

export function AuroraShader({
  stops,
  intensity,
  speed,
  waviness,
  coverage,
  colorSpace,
  hueInterpolation,
}: AuroraShaderProps) {
  const shaderContext = useShaderContext();
  const resize = useResize();

  const intensityUniform = useAnimatableUniform<number>(intensity);
  const speedUniform = useAnimatableUniform<number>(speed);
  const wavinessUniform = useAnimatableUniform<number>(waviness);
  const coverageUniform = useAnimatableUniform<number>(coverage);

  // Stable string proxy for the stops array — colors/positions are baked
  // into the ramp as literals, so a content change must rebuild the
  // material, but an identity-only change must not (see the AGENTS.md
  // gotchas on uniform stability and array props in effect deps).
  const stopsKey = colorStopsKey(stops);

  // Canvas aspect ratio (width/height), used to un-stretch the view ray on
  // wide canvases. Starts from the current size (16:9 fallback while the
  // canvas reports 0) and follows every resize.
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

  // ---------------------------------------------
  // Build the material and mount the mesh
  // ---------------------------------------------
  // Runs once per mount — and again only when the stops or color space
  // change, because colorRamp bakes the stop colors into the compiled
  // shader. The dials all flow through uniforms.
  useEffect(() => {
    const material = new MeshBasicNodeMaterial();
    const rampStops = toColorRampStops(stops);

    material.transparent = true;
    // rgb below is the accumulated curtain light itself (premultiplied);
    // alpha is coverage. Without this flag NormalBlending scales rgb by
    // alpha a second time and everything dims quadratically (MAT-45).
    material.premultipliedAlpha = true;

    // Fn() wraps the body in a reusable GPU function node; the trailing ()
    // calls it once to produce the node the material renders.
    const auroraNode = Fn(() => {
      // ---------------------------------------------
      // Aim the view ray
      // ---------------------------------------------
      // Screen uv → NDC; x carries the aspect so ribbons don't stretch on
      // wide canvases. y maps the canvas bottom to just above the
      // geometry's horizon (march distances flip negative below
      // rayDirection.y = -0.2 and sample behind the camera), so the whole
      // canvas is valid sky and the curtain band spans its full height.
      const ndcX = uv().x.sub(0.5).mul(2).mul(aspectNode);
      const ndcY = uv().y.mul(1.03).sub(0.03);

      // Virtual camera looking toward the horizon (+z); z sets the fov.
      const rayDirection = normalize(vec3(ndcX, ndcY, 1.064));

      // speed scales both time phases together so shimmer and drift stay
      // coupled.
      const warpPhase = elapsedTime.mul(speedUniform).mul(0.02);
      const domainPhase = elapsedTime.mul(speedUniform).mul(0.01);

      // ---------------------------------------------
      // March the ray, accumulating light
      // ---------------------------------------------
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
          wavinessUniform,
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

      // ---------------------------------------------
      // Coverage reveal and soft-clip
      // ---------------------------------------------
      // coverage is a screen-space reveal: 0 hides the aurora, 1 covers the
      // canvas, in between a soft fade line sweeps up from the bottom.
      const fadeEdge = float(1).sub(coverageUniform).mul(1.4);
      const horizonMask = smoothstep(fadeEdge.sub(0.4), fadeEdge, uv().y);

      // Soft-clip shaping: lifts the mids and rolls off the top instead of
      // clipping hot filaments. Applies to the alpha channel too — coverage
      // rode through the same average/extinction pipeline in .a. intensity
      // feeds the soft-clip, so hot values saturate instead of clipping.
      const shaped = smoothstep(
        0,
        1.1,
        accumulated.mul(horizonMask).mul(1.5).mul(intensityUniform),
      );

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
  }, [
    shaderContext,
    stopsKey,
    colorSpace,
    hueInterpolation,
    intensityUniform,
    speedUniform,
    wavinessUniform,
    coverageUniform,
    aspectNode,
  ]);

  return null;
}

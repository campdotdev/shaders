'use client';

import { useEffect } from 'react';

import {
  cos,
  dot,
  exp2,
  float,
  floor,
  Fn,
  fract,
  Loop,
  mix,
  normalize,
  screenCoordinate,
  type ShaderNodeObject,
  sin,
  smoothstep,
  texture,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import {
  FloatType,
  HalfFloatType,
  LinearFilter,
  Mesh,
  MeshBasicNodeMaterial,
  NearestFilter,
  type Node,
  PlaneGeometry,
  RedFormat,
  type Texture,
  Vector2,
} from 'three/webgpu';

import {
  colorRamp,
  type ColorSpace,
  createTexturePass,
  type HueInterpolation,
  type TSLNode,
} from '../../engine.js';
import type { ShaderContextValue } from '../../react/context/shader-context.js';
import type { AnimatableProp } from '../../react/hooks/animatable-signal/animatable-signal.js';
import { useAnimatableSpeed } from '../../react/hooks/use-animatable-speed/use-animatable-speed.js';
import { useAnimatableUniform } from '../../react/hooks/use-animatable-uniform/use-animatable-uniform.js';
import { useAspectUniform } from '../../react/hooks/use-aspect-uniform/use-aspect-uniform.js';
import {
  type ResizeSignal,
  type ResizeValue,
  useResize,
} from '../../react/hooks/use-resize/use-resize.js';
import { useShaderContext } from '../../react/hooks/use-shader-context/use-shader-context.js';
import { type ColorStop, colorStopsKey, toColorRampStops } from '../shared/color.js';
import {
  BEND_OFFSET,
  fieldTextureSize,
  FIRST_SLICE,
  FOCAL_LENGTH,
  HORIZON_BEND,
  RAY_ORIGIN,
  RAY_Y_AT_BOTTOM,
  RAY_Y_AT_TOP,
  skyPatch,
  SLICE_CURVE,
  SLICE_SPREAD,
  STEP_COUNT,
} from './sky.js';

// The aurora's GPU half. Unlike the flat 2D components, this one fakes a 3D
// scene: each pixel shoots a view ray toward a virtual horizon and marches
// along it in 60 steps (a "raymarch" — sampling a field at successive
// distances and accumulating what it hits). At every step it samples a
// layered noise field; where the noise creases, light accumulates, and the
// creases stack up into the curtain ribbons. Depth also picks the color:
// near slices take the ramp's first stops, far slices the last. A field
// pass draws the field into a texture once a frame (createFieldPass), and
// ./sky.ts holds the ray geometry the march and the pass share.
//
// Aurora technique inspired by nimitz's "Auroras" (shadertoy.com/view/XtGGRt):
// triangle-noise fbm, depth-sliced raymarch, average-then-accumulate
// compositing. Original TSL implementation. ("fbm" = fractal Brownian
// motion: the same noise stacked at several zoom levels — octaves — so big
// billows carry fine detail.)

type TSLValue = ShaderNodeObject<Node>;

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

/** A rotation by some angle, as that angle's cosine and sine. */
interface Rotation {
  cosine: TSLValue;
  sine: TSLValue;
}

/**
 * Rotate a vec2 by a rotation whose cosine and sine are already worked out,
 * without mat2 — keeps everything a plain chain. A caller that rotates by the
 * same angle many times works out the pair once and passes it to each call.
 */
const rotateBy = (point: TSLValue, { cosine, sine }: Rotation): TSLValue =>
  vec2(point.x.mul(cosine).sub(point.y.mul(sine)), point.x.mul(sine).add(point.y.mul(cosine)));

/** Rotate a vec2 by an angle that changes from call to call. */
const rotate2d = (point: TSLValue, angle: TSLNode): TSLValue =>
  rotateBy(point, { cosine: cos(angle), sine: sin(angle) });

/** The two rotations every octave of the field applies. */
interface MotionRotations {
  /** The shimmer: turns each octave's warp offset. */
  warp: Rotation;
  /** The drift: turns the whole domain a little after each octave. */
  domain: Rotation;
}

/**
 * Both rotations, worked out once from the accumulated phase. Call it inside
 * Fn(), because .toVar() stores each cosine and sine in a GPU variable at
 * the point of the call, which needs Fn's list of statements. Every octave
 * then reads the four variables instead of redoing the trig (the first-use
 * gotcha in docs/agents/tsl.md).
 */
const motionRotations = (phase: ReturnType<typeof uniform<number>>): MotionRotations => {
  // Both motion phases derive from the same accumulated phase, so shimmer
  // and drift stay coupled and keep their 2:1 rate ratio.
  const warpPhase = phase.mul(0.02);
  const domainPhase = phase.mul(0.01);

  return {
    warp: { cosine: cos(warpPhase).toVar(), sine: sin(warpPhase).toVar() },
    domain: { cosine: cos(domainPhase).toVar(), sine: sin(domainPhase).toVar() },
  };
};

/**
 * Five-octave triangle-noise fbm, as the raw sum of its ridge terms. Each
 * octave warps the domain with a rotated triangle-wave offset (the shimmer),
 * climbs a lacunarity/gain ladder, accumulates a ridge term, and rotates the
 * whole domain a little (the drift). The sum is smooth except at the
 * creases, where it dips toward 0 in a sharp V; `filaments` turns those
 * dips into light.
 */
const ridgeSum = (
  coords: TSLValue,
  { warp: warpRotation, domain: domainRotation }: MotionRotations,
  warpStrength: TSLNode,
): TSLValue => {
  let ridgeGain = 1.8;
  let warpGain = 2.5;
  let sum: TSLValue = float(0);
  let point = rotate2d(coords, coords.x.mul(0.06));
  let warpPoint = point;

  for (let octave = 0; octave < 5; octave += 1) {
    const warp = rotateBy(
      triangleWave2(warpPoint.mul(1.85)).mul(0.75).mul(warpStrength),
      warpRotation,
    );

    point = point.sub(warp.div(warpGain));

    warpPoint = warpPoint.mul(1.3);
    warpGain *= 0.45;
    ridgeGain *= 0.42;
    point = point.mul(sum.sub(1).mul(0.02).add(1.21));

    sum = sum.add(triangleWave(point.x.add(triangleWave(point.y))).mul(ridgeGain));
    point = rotateBy(point, domainRotation);
  }

  return sum;
};

/**
 * Reciprocal-power shaping: 1 / (20 * sum)^1.3, clamped to 0..1. It is full
 * brightness where the sum dips below 0.05, at a crease, and falls off fast
 * either side (0.4 at a sum of 0.1, 0.1 at 0.3), which concentrates the
 * light into thin filaments.
 *
 * The field texture stores the sum before this step, not after. A texture
 * read between texels blends its neighbours linearly, and blending the
 * smooth sum keeps a crease's V almost intact, where blending the shaped
 * value would smear each filament across a texel.
 */
const filaments = (sum: TSLValue): TSLValue => float(1).div(sum.mul(20).pow(1.3)).clamp(0, 1);

/**
 * The field texture's density, in texels per canvas pixel along each side:
 * at 0.7 the texture has about half as many texels as the canvas has
 * pixels. Chosen by eye at the SHA-208 gate, as the lowest density that
 * looks the same as the field worked out at every step; lower softens the
 * filaments. The field pass is a small share of a frame, so density moves
 * memory more than GPU time: at the homepage hero's size at 2x, 1 measured
 * 5.1 ms a frame and 0.5 measured 4.9 ms.
 */
const FIELD_DENSITY = 0.7;

// ----------------------------------------------------------------------------
// The field pass: the field drawn once a frame
// ----------------------------------------------------------------------------

type FloatUniform = ReturnType<typeof uniform<number>>;
type Vector2Uniform = ReturnType<typeof uniform<Vector2>>;

/** The field pass's texture, how the march finds a sky point in it, and its teardown. */
interface FieldPass {
  /** The raw ridge sum over the patch of sky the rays reach, one channel. */
  texture: Texture;
  /** The patch's near-left corner on the sky plane: its smallest x and z. */
  patchCorner: Vector2Uniform;
  /** 1 over the patch's size, so (point - corner) * scale is a 0..1 texture coordinate. */
  patchScale: Vector2Uniform;
  /** Stop drawing and refitting the field, and release its texture. */
  dispose: () => void;
}

interface FieldPassInputs {
  shaderContext: ShaderContextValue;
  /** The canvas size, which the patch and the texel count follow. */
  resize: ResizeSignal;
  /** The canvas aspect ratio, for a canvas that reports a size of 0. */
  aspect: FloatUniform;
  phase: FloatUniform;
  waviness: FloatUniform;
}

/**
 * Draws the field into a texture once a frame, so each march step reads one
 * texel instead of working out five octaves. The field depends on a point on
 * the sky plane and on the uniforms, never on the pixel, so every pixel's 60
 * samples read the same 2D field. Returns null where the renderer cannot
 * draw into a half-float target, and the march works out the field inline.
 *
 * The texture covers the patch of the sky plane the rays reach (see
 * ./sky.ts), stretched over the texture's 0..1 square: texel x runs across
 * the screen and texel y toward the horizon. Two vec2 uniforms carry the
 * mapping, so a sky point maps to a texture coordinate as
 * (point - corner) * scale, and back as uv / scale + corner. Both are passed
 * as arguments, never chained from (the vec-uniform gotcha in
 * docs/agents/tsl.md).
 *
 * The caller creates and disposes the pass in one effect, so a Strict Mode
 * remount builds a fresh one (the Strict Mode gotcha in docs/agents/tsl.md).
 */
function createFieldPass({
  shaderContext,
  resize,
  aspect,
  phase,
  waviness,
}: FieldPassInputs): FieldPass | null {
  const renderer = shaderContext.renderer.three;
  const patchCorner = uniform(new Vector2());
  const patchScale = uniform(new Vector2(1, 1));

  // One texel's value: the raw ridge sum at the sky point under it. vec2
  // swaps to (z, x) because the field takes z first, as the march samples
  // it. Each texel works out the rotations for itself, four trig calls per
  // texel, which is nothing beside the octaves.
  const fieldNode = Fn(() => {
    const skyPoint = uv().div(patchScale).add(patchCorner);

    return vec4(ridgeSum(vec2(skyPoint.y, skyPoint.x), motionRotations(phase), waviness), 0, 0, 1);
  })();

  // A half float holds the sum to about three significant digits, which
  // moves brightness near a filament by well under 1%. An 8-bit texel would
  // move it by about 6% per step and band. Linear filtering blends the four
  // texels around each read, so the sum varies smoothly between texel
  // centers. One channel stores a quarter of the bytes an RGBA texel would.
  const pass = createTexturePass(renderer, fieldNode, {
    width: 1,
    height: 1,
    type: HalfFloatType,
    filter: LinearFilter,
    format: RedFormat,
  });
  const fieldTexture = pass.texture;

  if (fieldTexture === null) return null;

  // Size the texture and its patch to the canvas: the patch from the aspect
  // ratio, the texel count from the canvas's size in device pixels. That
  // size is the CSS size times the renderer's pixel ratio, rather than the
  // drawing buffer, which still holds the old size when a zoom reaches this
  // listener before the renderer resizes. A collapsed canvas reports 0, so
  // the aspect falls back to the uniform's own. The write asks for a frame,
  // because a parked scene would otherwise keep showing the old field (the
  // bare-uniform-write gotcha in docs/agents/tsl.md).
  const fit = ([width, height]: ResizeValue) => {
    const patch = skyPatch(width > 0 && height > 0 ? width / height : aspect.value);
    const pixelRatio = renderer.getPixelRatio();
    const size = fieldTextureSize(patch, width * pixelRatio, height * pixelRatio, FIELD_DENSITY);

    patchCorner.value.set(patch.minX, patch.minZ);
    patchScale.value.set(1 / (patch.maxX - patch.minX), 1 / (patch.maxZ - patch.minZ));
    pass.resize(size.width, size.height);
    shaderContext.scheduler.requestRender();
  };

  fit(resize.get());
  const stopFitting = resize.on('change', fit);

  // The output stage draws pre-passes ahead of the scene pass in the same
  // frame, so the march always reads this frame's field, and the resize
  // redraw draws the field at the new size before the scene reads it (the
  // draw-order gotcha in docs/agents/tsl.md).
  const removePrePass = shaderContext.registerPrePass(pass.render);

  return {
    texture: fieldTexture,
    patchCorner,
    patchScale,
    dispose() {
      removePrePass();
      stopFitting();
      pass.dispose();
    },
  };
}

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

  const intensityUniform = useAnimatableUniform<number>(intensity);
  // Speed is integrated on the CPU into a phase uniform (speed x delta per
  // frame), so tempo changes glide instead of snapping the curtain.
  const phaseUniform = useAnimatableSpeed(speed);
  const wavinessUniform = useAnimatableUniform<number>(waviness);
  const coverageUniform = useAnimatableUniform<number>(coverage);

  // Stable string proxy for the stops array — colors/positions are baked
  // into the ramp as literals, so a content change must rebuild the
  // material, but an identity-only change must not (see the
  // uniform-stability and array-props gotchas in docs/agents/tsl.md).
  const stopsKey = colorStopsKey(stops);

  // Canvas aspect ratio (width/height), used to un-stretch the view ray on
  // wide canvases. useAspectUniform keeps it current across resizes.
  const aspectNode = useAspectUniform();
  // The canvas size, which sizes the field texture and its patch of sky.
  const resize = useResize();

  // ---------------------------------------------
  // Build the material and mount the mesh
  // ---------------------------------------------
  // Runs once per mount — and again only when the stops or color space
  // change, because colorRamp bakes the stop colors into the compiled
  // shader, and the slice palette below is drawn from it. The dials all
  // flow through uniforms.
  useEffect(() => {
    const material = new MeshBasicNodeMaterial();
    const rampStops = toColorRampStops(stops);

    material.transparent = true;
    // rgb below is the accumulated curtain light itself (premultiplied);
    // alpha is coverage. Without this flag NormalBlending scales rgb by
    // alpha a second time and everything dims quadratically (MAT-45).
    material.premultipliedAlpha = true;

    // ---------------------------------------------
    // Draw the slice palette
    // ---------------------------------------------
    // Depth-stratified color: the slice index drives the user ramp, so near
    // and far ribbons glow different stops. pow keeps the upper stops
    // visible: extinction weights early slices, so a linear index would
    // read as stop 0 almost everywhere.
    const rampColorAt = (stepIndex: TSLValue) =>
      colorRamp(stepIndex.div(STEP_COUNT).pow(0.6), rampStops, colorSpace, hueInterpolation);

    // The slice color depends on the step alone, yet the ramp behind it
    // (an oklab round trip per stop, plus the mixes) would run 60 times for
    // every pixel. So a texture pass (src/runtime/texture-pass) draws it
    // once per material build into a palette: a texture with one texel (one
    // pixel of a texture) per step, which the march loop reads from.
    //
    // Each texel runs the same ramp at its own step. uv().x is the texel's
    // 0..1 position, and at texel i's center, (i + 0.5) / 60, times 60
    // floors to i exactly. Full float keeps the ramp's colors as computed
    // rather than rounded to 8 or 16 bits, and nearest filtering hands back
    // one texel unmixed with its neighbours, so the color matches the
    // inline ramp. The pass is created, drawn, and disposed in this effect,
    // so a Strict Mode remount builds a fresh one (the Strict Mode gotcha in
    // docs/agents/tsl.md).
    const slicePalette = shaderContext
      ? createTexturePass(
          shaderContext.renderer.three,
          vec4(rampColorAt(floor(uv().x.mul(STEP_COUNT))), 1),
          { width: STEP_COUNT, height: 1, type: FloatType, filter: NearestFilter },
        )
      : null;

    slicePalette?.render();

    // Null when the renderer cannot draw into a full-float target or bind
    // one (WebGL2 without EXT_color_buffer_float, or a WebGPU device without
    // float32-filterable, the float32-filterable gotcha in
    // docs/agents/tsl.md), in which case each step runs the ramp inline as
    // before.
    const paletteTexture = slicePalette?.texture ?? null;

    // A texture node is the GPU's handle on an image, read here at step i's
    // texel center so nearest filtering lands on texel i alone. The
    // coordinate goes in when the node is built, rather than through .uv()
    // on a bare texture(), which would add a 3x3 matrix multiply to every
    // read (the texture-matrix gotcha in docs/agents/tsl.md).
    const sliceColorAt = (stepIndex: TSLValue) =>
      paletteTexture === null
        ? rampColorAt(stepIndex)
        : texture(paletteTexture, vec2(stepIndex.add(0.5).div(STEP_COUNT), 0.5)).rgb;

    // The field pass, which draws the field once a frame for the march to
    // read (see createFieldPass above). Null outside a scene, or where the
    // renderer cannot draw into a half-float target (WebGL2 without
    // EXT_color_buffer_float). The march then works out the field at every
    // step, as it did before the field pass, with the same TSL. Aurora
    // draws its own image, so it must never draw nothing.
    const fieldPass = shaderContext
      ? createFieldPass({
          shaderContext,
          resize,
          aspect: aspectNode,
          phase: phaseUniform,
          waviness: wavinessUniform,
        })
      : null;

    // Fn() wraps the body in a reusable GPU function node; the trailing ()
    // calls it once to produce the node the material renders.
    const auroraNode = Fn(() => {
      // ---------------------------------------------
      // Aim the view ray
      // ---------------------------------------------
      // Screen uv → NDC; x carries the aspect so ribbons don't stretch on
      // wide canvases. y runs from RAY_Y_AT_BOTTOM at the canvas bottom to
      // RAY_Y_AT_TOP at its top (./sky.ts says why).
      const ndcX = uv().x.sub(0.5).mul(2).mul(aspectNode);
      const ndcY = uv()
        .y.mul(RAY_Y_AT_TOP - RAY_Y_AT_BOTTOM)
        .add(RAY_Y_AT_BOTTOM);

      // Virtual camera looking toward the horizon (+z); FOCAL_LENGTH sets
      // the fov.
      //
      // .toVar() stores the result in a GPU variable at this point in the
      // shader. Without it, TSL writes an expression out where the shader
      // first uses it, and the ray is first used inside the march loop
      // below, so every step would redo the normalize (the first-use gotcha
      // in docs/agents/tsl.md). The same goes for the jitter seed and the
      // rotations below.
      const rayDirection = normalize(vec3(ndcX, ndcY, FOCAL_LENGTH)).toVar();

      // The field at a sample point. With a field texture, one read at the
      // point's place in the patch; the texture's linear filter blends the
      // four nearest texels. Without one, all five octaves at the point,
      // with the rotations worked out once here, before the loop. Either
      // way the shaping runs on the value the march gets.
      const fieldSumAt = (() => {
        if (fieldPass !== null) {
          const { texture: fieldTexture, patchCorner, patchScale } = fieldPass;

          return (samplePoint: TSLValue) =>
            texture(
              fieldTexture,
              vec2(samplePoint.x, samplePoint.z).sub(patchCorner).mul(patchScale),
            ).r;
        }
        const rotations = motionRotations(phaseUniform);

        return (samplePoint: TSLValue) =>
          ridgeSum(vec2(samplePoint.z, samplePoint.x), rotations, wavinessUniform);
      })();

      // ---------------------------------------------
      // March the ray, accumulating light
      // ---------------------------------------------
      // Per-pixel jitter seed: decorrelates slice offsets pixel-to-pixel so
      // the discrete march dissolves into grain instead of contour banding.
      const jitterSeed = hashNoise(screenCoordinate.xy).toVar();

      // Loop state must be GPU-side variables (toVar) — the loop runs on the
      // GPU, so a JS binding can't change per iteration there.
      const accumulated = vec4(0).toVar();
      const runningAverage = vec4(0).toVar();

      Loop(STEP_COUNT, ({ i }: { i: TSLValue }) => {
        const stepIndex = float(i);

        // Ramp jitter in over the first slices — the lowest slices draw the
        // curtain's sharp bottom edge and shouldn't be blurred.
        const jitter = jitterSeed.mul(0.006).mul(smoothstep(0, 15, stepIndex));

        // pow(i, SLICE_CURVE) packs slices tight at the base and spreads
        // them with height; the bent divisor fakes atmospheric curvature so
        // horizon-grazing rays push the sheet toward the horizon line.
        const marchDistance = stepIndex
          .pow(SLICE_CURVE)
          .mul(SLICE_SPREAD)
          .add(FIRST_SLICE)
          .div(rayDirection.y.mul(HORIZON_BEND).add(BEND_OFFSET))
          .sub(jitter);

        const samplePoint = vec3(RAY_ORIGIN).add(rayDirection.mul(marchDistance));

        // Sample the field on the horizontal plane: z runs toward the
        // horizon, x runs across the screen.
        const fieldValue = filaments(fieldSumAt(samplePoint));

        // This slice's color: its palette texel, or the inline ramp where
        // the renderer has no palette.
        const sliceColor = sliceColorAt(stepIndex);

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
      fieldPass?.dispose();
      shaderContext?.scene.remove(mesh);
      try {
        material.dispose();
      } catch {
        // three/webgpu can throw during dispose under Strict Mode double-invoke
      }
      slicePalette?.dispose();
    };
    // stopsKey stands in for stops (content proxy; rampStops derives from it).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    shaderContext,
    stopsKey,
    colorSpace,
    hueInterpolation,
    intensityUniform,
    phaseUniform,
    wavinessUniform,
    coverageUniform,
    aspectNode,
    resize,
  ]);

  return null;
}

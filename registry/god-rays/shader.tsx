'use client';

// The god rays' GPU half. The wrapper (./god-rays.tsx) passes resolved props
// down; this component builds a full-screen plane whose per-pixel color is a
// field of soft light rays radiating from a chosen origin — the product of
// two flowing polar noise fields, so rays break up along their length and
// the pattern flickers as the fields slide past each other. Each color in
// `colors` spawns its own decorrelated copy of that field, and the layers'
// light adds together — overlapping beams brighten like real light. The
// component emits light over a transparent background — stack it above a
// dark layer.
import { useEffect, useMemo } from 'react';

import {
  type AnimatableProp,
  useAnimatablePoint,
  useAnimatableSpeed,
  useAnimatableUniform,
  useResize,
  useShaderContext,
  useStaticSceneHint,
} from '@lovo/matter-react';
import {
  atan2,
  cos,
  dot,
  float,
  floor,
  Fn,
  fract,
  length,
  mix,
  sin,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import type { ShaderNodeObject } from 'three/tsl';
import { Mesh, MeshBasicNodeMaterial, type Node, PlaneGeometry } from 'three/webgpu';

import { parseColor } from '../utils/color';

type TSLValue = ShaderNodeObject<Node>;

export interface GodRaysShaderProps {
  /**
   * Ray colors, near to far — each color spawns its own decorrelated layer
   * of rays, later colors progressively finer-textured so they read as
   * deeper planes. Overlapping layers add their light. Accepts hex,
   * `oklch()`, or `oklab()` strings.
   */
  colors: string[];
  /**
   * Ray origin, 0..1 across the canvas; `[0.5, 0.5]` is centered and
   * `[0, 0]` is the top-left corner. Values outside 0..1 park the source
   * off-canvas. Accepts a static value or an animation signal.
   */
  center: AnimatableProp<readonly [number, number]>;
  /**
   * Roughly how many rays fit around a full revolution before the two-field
   * product thins them. Higher packs more, thinner rays; lower gives a few
   * broad ones. Accepts a static value or an animation signal.
   */
  density: AnimatableProp<number>;
  /**
   * How defined the rays are. 0 is a soft overlapping haze of wide lobes;
   * 1 narrows them into distinct, separated beams.
   * Accepts a static value or an animation signal.
   */
  definition: AnimatableProp<number>;
  /**
   * How broken the rays are along their length. 0 gives long continuous
   * streaks; 1 chops them into short drifting dashes.
   * Accepts a static value or an animation signal.
   */
  patchiness: AnimatableProp<number>;
  /**
   * Overall brightness. 0 hides the rays.
   * Accepts a static value or an animation signal.
   */
  intensity: AnimatableProp<number>;
  /**
   * Flow tempo — how fast light streams outward and the ray pattern
   * flickers. 0 freezes the motion.
   * Accepts a static value or an animation signal.
   */
  speed: AnimatableProp<number>;
  /**
   * TEMPORARY (build-phase tuning only): dev overrides for the field
   * character constants. Stripped — with the constants baked back in — at
   * the defaults-tuning gate.
   */
  tuning?: {
    patchScale?: number;
    flowA?: number;
    flowB?: number;
    fieldARadial?: number;
    fieldBRadial?: number;
  };
}

// Converts the density dial (rays per revolution) into the radius of the
// circle the noise is sampled on. Simplex features are ~1 unit wide, so a
// circle of circumference N passes ~N features per revolution:
// radius = N / (2 * PI).
const DENSITY_TO_CIRCLE = 1 / (2 * Math.PI);

// Angular frequency multipliers applied on top of the density dial (5:4,
// straight from the reference). Two jobs: the detuned ratio keeps the
// fields from locking, so the product's bright spots continuously form and
// dissolve — and the ×4-5 scale keeps each noise cell only a few degrees
// wide. Cell shape is load-bearing: cells are what a near-zero hash paints
// dark, and thin radial slivers read as natural gaps between rays, where
// the fat cells of an unmultiplied frequency read as blotches (the R1
// gate's recurring artifact, root-caused on the fourth round).
const FIELD_A_ANGULAR = 5;
const FIELD_B_ANGULAR = 4;

// How fast each field's texture varies along the ray, per unit of
// corner-normalized distance. Higher = shorter features along the beam.
// B is coarser; the patchiness dial (next phase) multiplies B's rate up.
const FIELD_A_RADIAL = 2.0;
const FIELD_B_RADIAL = 1.0;

// Outward flow per phase unit (phase advances ~1/second at speed 1), held
// at a 3:2 ratio between the fields — the beat between the two speeds is
// what makes the texture evolve instead of scrolling rigidly.
const FLOW_A = 0.6;
const FLOW_B = 0.4;

// The definition dial's exponent range: pow(field, exponent) narrows the
// bright lobes as the exponent climbs, without ever creating a hard edge.
// EXP_SOFT is the haze end (nearly the raw field); EXP_DEFINED is the
// separated-beams end. Widening the range makes the dial more dramatic.
const EXP_SOFT = 1.2;
const EXP_DEFINED = 4.0;

// How strongly patchiness multiplies field B's along-ray frequency at
// dial position 1. Higher = the dashes get shorter faster.
const PATCH_SCALE = 6;

// ---------------------------------------------
// Per-layer decorrelation
// ---------------------------------------------
// Each color's ray system lives in its own rotated frame with its own
// angular-frequency multiplier and radial-scale step, so layers read as
// independent depth planes rather than tinted copies of one pattern. The
// jitter table is deterministic on purpose (visual regression tests forbid
// runtime randomness); values are hand-picked to be non-harmonic so no two
// layers' rays ever lock into step.

// Radians between successive layers' angular frames — far enough apart
// that layer 2's rays never sit on top of layer 1's.
const LAYER_ROTATION = 1.0;

// Multiplies each layer's angular frequency (both fields, so the 5:4
// detune is preserved within a layer). Indexed by layer, up to 5 colors.
const LAYER_FREQ_JITTER = [1.0, 1.35, 0.8, 1.6, 1.15];

// How much field A's along-ray rate grows per layer (0.4 = layer 3 varies
// 1.8x faster than layer 0) — deeper layers get finer texture, which is
// most of the depth illusion.
const LAYER_RADIAL_STEP = 0.4;

// ---------------------------------------------
// Value noise (local helper)
// ---------------------------------------------
// The engine's simplex noise is mid-heavy with large coherent low basins,
// which kept surfacing as dark blotches in the ray product no matter how
// its output was reshaped (three R1 gate rounds). Value noise — random
// 0..1 values on a lattice, smoothly blended — is uniformly distributed
// like the reference shader's noise, so darks stay alive everywhere and no
// remap is needed at all. Built locally the way Aurora builds hashNoise.

/** Uniform 0..1 hash of a 3D lattice point (sin-free fract-dot construction). */
const hash3 = (point: TSLValue): TSLValue => {
  const spread = fract(point.mul(0.1031));
  const mixed = spread.add(dot(spread, vec3(spread.z, spread.y, spread.x).add(31.32)));

  return fract(mixed.x.add(mixed.y).mul(mixed.z));
};

/**
 * 3D value noise in 0..1: hash the 8 corners of the surrounding lattice
 * cell, then blend with a smoothstep fade per axis (the fade removes the
 * creases plain trilinear blending would show at cell walls).
 */
const valueNoise3 = (point: TSLValue): TSLValue => {
  const cell = floor(point);
  const local = fract(point);
  const fade = local.mul(local).mul(float(3).sub(local.mul(2)));
  const corner = (x: number, y: number, z: number): TSLValue => hash3(cell.add(vec3(x, y, z)));

  const bottom = mix(
    mix(corner(0, 0, 0), corner(1, 0, 0), fade.x),
    mix(corner(0, 1, 0), corner(1, 1, 0), fade.x),
    fade.y,
  );
  const top = mix(
    mix(corner(0, 0, 1), corner(1, 0, 1), fade.x),
    mix(corner(0, 1, 1), corner(1, 1, 1), fade.x),
    fade.y,
  );

  return mix(bottom, top, fade.z);
};

export function GodRaysShader({
  colors,
  center,
  density,
  definition,
  patchiness,
  intensity,
  speed,
  tuning,
}: GodRaysShaderProps) {
  const shaderContext = useShaderContext();

  // Stable string proxy for the colors array — the layer colors are baked
  // into the compiled shader as literals, so a content change must rebuild
  // the material, but an identity-only change (a parent re-render passing a
  // fresh array) must not (see the AGENTS.md gotcha on array props in
  // effect deps).
  const colorsKey = colors.join('|');

  // A literal speed of 0 means nothing on screen ever changes (an animation
  // signal might move later, so it doesn't count). Telling the scene lets its
  // frame scheduler go idle instead of re-rendering an unchanging image.
  const isStatic = typeof speed === 'number' && speed === 0;

  useStaticSceneHint(isStatic);

  const densityUniform = useAnimatableUniform<number>(density);
  const definitionUniform = useAnimatableUniform<number>(definition);
  const patchinessUniform = useAnimatableUniform<number>(patchiness);
  const intensityUniform = useAnimatableUniform<number>(intensity);

  // TEMPORARY (build-phase tuning only): the character constants ride
  // uniforms so the dev sliders glide instead of rebuilding the material.
  const patchScaleUniform = useAnimatableUniform<number>(tuning?.patchScale ?? PATCH_SCALE);
  const flowAUniform = useAnimatableUniform<number>(tuning?.flowA ?? FLOW_A);
  const flowBUniform = useAnimatableUniform<number>(tuning?.flowB ?? FLOW_B);
  const fieldARadialUniform = useAnimatableUniform<number>(tuning?.fieldARadial ?? FIELD_A_RADIAL);
  const fieldBRadialUniform = useAnimatableUniform<number>(tuning?.fieldBRadial ?? FIELD_B_RADIAL);
  // Speed is integrated on the CPU into a phase uniform (speed x delta per
  // frame), so tempo changes glide instead of snapping the pattern.
  const phaseUniform = useAnimatableSpeed(speed);

  // screenOrigin converts the prop's screen-style coordinates (y grows
  // downward, like CSS) into uv space, where v grows upward — same as
  // RadialGradient. Without it, lowering the center would raise the rays.
  const centerUniform = useAnimatablePoint(center, { screenOrigin: true });

  // ---------------------------------------------
  // Track the canvas aspect ratio
  // ---------------------------------------------
  // The polar math needs width/height so rays stay evenly spaced in angle on
  // wide canvases. Starts from the current size (16:9 fallback while the
  // canvas reports 0), then follows every resize.
  const resize = useResize();
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
      if (updatedWidth > 0 && updatedHeight > 0) {
        aspectNode.value = updatedWidth / updatedHeight;
        // At speed 0 the scene is hinted static, so without this poke a
        // resize would update the uniform and never repaint.
        shaderContext?.scheduler.requestRender();
      }
    });
  }, [shaderContext, resize, aspectNode]);

  // ---------------------------------------------
  // Build the material and mount the mesh
  // ---------------------------------------------
  useEffect(() => {
    if (!shaderContext) return;

    const material = new MeshBasicNodeMaterial();

    // Decode the color strings into linear rgb triples once per rebuild;
    // the loop below bakes them into the shader as literals.
    const layerColors = colors.map(parseColor);

    material.transparent = true;
    // rgb below is emitted light (premultiplied); alpha is coverage. Without
    // this flag NormalBlending scales rgb by alpha a second time and the
    // soft ray edges dim quadratically.
    material.premultipliedAlpha = true;

    const godRaysNode = Fn(() => {
      // ---------------------------------------------
      // Polar conversion
      // ---------------------------------------------
      // Where is this pixel relative to the ray origin? uv() is its 0..1
      // position; subtracting the center gives an offset. Multiplying the
      // horizontal offset by width/height puts both axes in the same units,
      // so angles and distances aren't stretched by the canvas shape.
      const centered = uv().sub(centerUniform);
      const corrected = vec2(centered.x.mul(aspectNode), centered.y);

      // Distance from the canvas center to a corner in those units; dividing
      // by it makes dist read 0 at the origin and 1 at "corner distance" on
      // any canvas shape (RadialGradient's convention).
      const halfDiagonal = length(vec2(aspectNode.mul(0.5), 0.5));
      const dist = length(corrected).div(halfDiagonal);

      // The pixel's direction from the origin, in radians, -PI..PI.
      // 0 points right, PI/2 points up (uv's v grows upward).
      const theta = atan2(corrected.y, corrected.x);

      // ---------------------------------------------
      // Ray field — product of two flowing polar noises, once per color
      // ---------------------------------------------
      // Each field samples noise ON A CIRCLE in 3D noise space — walking a
      // full revolution returns exactly to its start, so 360° is seamless
      // by construction, and the circle's size sets the ray count. The
      // third axis carries the pixel's distance MINUS the flow phase, so
      // the texture varies along the ray AND streams outward over time.
      //
      // Two such fields at detuned angular frequencies and 3:2 flow rates
      // are MULTIPLIED: a pixel lights only where both are bright, which
      // breaks the rays into soft patches, and as the fields slide past
      // each other at different speeds the bright spots form, stretch, and
      // dissolve — interference, not translation. This product IS the
      // god-rays texture — and each color gets its own decorrelated copy
      // (rotated frame, jittered frequency, stepped radial rate; see the
      // per-layer constants above).

      // The definition dial is the shaping exponent: pow() pulls the
      // midtones down while pinning the peaks, so raising it narrows every
      // bright lobe into a more separated beam — always smoothly, since a
      // power curve has no threshold to alias against.
      const exponent = mix(float(EXP_SOFT), float(EXP_DEFINED), definitionUniform);

      // Patchiness multiplies field B's along-ray frequency: the faster B
      // varies along the ray, the shorter the stretches where both fields
      // stay bright — long streaks chop into drifting dashes.
      const fieldBRadialRate = fieldBRadialUniform.mul(
        patchinessUniform.mul(patchScaleUniform).add(1),
      );

      // Layer light is ADDITIVE — overlapping beams brighten each other the
      // way real light does, so a dark color can tint the sum but never
      // occlude it (alpha-over compositing was tried first and read as
      // smoke: a layer's coverage blocked more backdrop than its color's
      // luminance refilled). Coverage still accumulates over, so alpha
      // stays a true 0..1 amount for blending with the layers below the
      // component. This is a JS loop, so it unrolls at shader-build time —
      // the layer count is a material rebuild, never a uniform.
      let accumRgb: TSLValue = vec3(0);
      let accumAlpha: TSLValue = float(0);

      layerColors.forEach(([red, green, blue], layerIndex) => {
        // This layer's own angular frame and frequencies. Rotating theta
        // spins the whole ray system; the jitter multiplies BOTH circles so
        // the layer keeps its internal 5:4 detune while disagreeing with
        // every other layer about where rays sit and how many there are.
        const layerTheta = theta.add(layerIndex * LAYER_ROTATION);
        const frequencyJitter = LAYER_FREQ_JITTER[layerIndex] ?? 1;
        const circleA = densityUniform.mul(FIELD_A_ANGULAR * frequencyJitter * DENSITY_TO_CIRCLE);
        const circleB = densityUniform.mul(FIELD_B_ANGULAR * frequencyJitter * DENSITY_TO_CIRCLE);

        // Deeper layers vary faster along the ray (finer texture reads as
        // farther away).
        const layerRadialRateA = fieldARadialUniform.mul(1 + LAYER_RADIAL_STEP * layerIndex);

        const fieldA = valueNoise3(
          vec3(
            cos(layerTheta).mul(circleA),
            sin(layerTheta).mul(circleA),
            dist.mul(layerRadialRateA).sub(phaseUniform.mul(flowAUniform)),
          ),
        ).pow(exponent);
        const fieldB = valueNoise3(
          vec3(
            cos(layerTheta).mul(circleB),
            sin(layerTheta).mul(circleB),
            dist.mul(fieldBRadialRate).sub(phaseUniform.mul(flowBUniform)),
          ),
        ).pow(exponent);

        const ray = fieldA.mul(fieldB);

        // The layer's light joins the sum unconditionally (additive); its
        // coverage claims only what earlier layers left open (over).
        const sourceRgb = vec3(red, green, blue).mul(ray);

        accumRgb = accumRgb.add(sourceRgb);
        accumAlpha = accumAlpha.add(ray.mul(accumAlpha.oneMinus()));
      });

      // Premultiplied output: rgb is the summed light itself (it can exceed
      // 1 where beams pile up — the soft-clip arriving with the masks phase
      // shapes that gracefully), alpha its coverage. Intensity scales the
      // light, not the coverage.
      return vec4(accumRgb.mul(intensityUniform), accumAlpha.clamp(0, 1));
    })();

    material.colorNode = godRaysNode;

    // A 2x2 plane exactly fills ShaderScene's camera view (-1..1 both axes).
    const mesh = new Mesh(new PlaneGeometry(2, 2), material);

    shaderContext.scene.add(mesh);

    return () => {
      shaderContext.scene.remove(mesh);
      try {
        material.dispose();
      } catch {
        // three/webgpu can throw during dispose under Strict Mode double-invoke
      }
      try {
        mesh.geometry.dispose();
      } catch {
        // same
      }
    };
    // colorsKey stands in for colors (content proxy; layerColors derives
    // from it inside the effect).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    shaderContext,
    colorsKey,
    densityUniform,
    definitionUniform,
    patchinessUniform,
    intensityUniform,
    patchScaleUniform,
    flowAUniform,
    flowBUniform,
    fieldARadialUniform,
    fieldBRadialUniform,
    phaseUniform,
    centerUniform,
    aspectNode,
  ]);

  return null;
}

'use client';

// The god rays' GPU half. The wrapper (./god-rays.tsx) passes resolved props
// down; this component builds a full-screen plane whose per-pixel color is a
// field of soft light rays radiating from a chosen origin — the product of
// two flowing polar noise fields, so rays break up along their length and
// the pattern flickers as the fields slide past each other. The component
// emits light over a transparent background — stack it above a dark layer.
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

type TSLValue = ShaderNodeObject<Node>;

export interface GodRaysShaderProps {
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

// Fixed shaping exponent for this phase; becomes the definition dial next.
// Raising it narrows the bright lobes without ever creating a hard edge.
const BASE_EXPONENT = 2.0;

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

export function GodRaysShader({ center, density, intensity, speed }: GodRaysShaderProps) {
  const shaderContext = useShaderContext();

  // A literal speed of 0 means nothing on screen ever changes (an animation
  // signal might move later, so it doesn't count). Telling the scene lets its
  // frame scheduler go idle instead of re-rendering an unchanging image.
  const isStatic = typeof speed === 'number' && speed === 0;

  useStaticSceneHint(isStatic);

  const densityUniform = useAnimatableUniform<number>(density);
  const intensityUniform = useAnimatableUniform<number>(intensity);
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
      // Ray field — product of two flowing polar noises
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
      // god-rays texture.
      const circleA = densityUniform.mul(FIELD_A_ANGULAR * DENSITY_TO_CIRCLE);
      const circleB = densityUniform.mul(FIELD_B_ANGULAR * DENSITY_TO_CIRCLE);

      const fieldA = valueNoise3(
        vec3(
          cos(theta).mul(circleA),
          sin(theta).mul(circleA),
          dist.mul(FIELD_A_RADIAL).sub(phaseUniform.mul(FLOW_A)),
        ),
      ).pow(BASE_EXPONENT);
      const fieldB = valueNoise3(
        vec3(
          cos(theta).mul(circleB),
          sin(theta).mul(circleB),
          dist.mul(FIELD_B_RADIAL).sub(phaseUniform.mul(FLOW_B)),
        ),
      ).pow(BASE_EXPONENT);

      const ray = fieldA.mul(fieldB);

      const lit = ray.mul(intensityUniform).clamp(0, 1);

      // Premultiplied output: rgb is the light itself, alpha its coverage.
      return vec4(vec3(lit), lit);
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
  }, [shaderContext, densityUniform, intensityUniform, phaseUniform, centerUniform, aspectNode]);

  return null;
}

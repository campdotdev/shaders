'use client';

// The god rays' GPU half. The wrapper (./god-rays.tsx) passes resolved props
// down; this component builds a full-screen plane whose per-pixel color is a
// field of light rays radiating from a chosen origin, and mounts it into the
// shared ShaderScene. The component emits light over a transparent
// background — stack it above a dark layer.
import { useEffect, useMemo } from 'react';

import { simplexNoise } from '@lovo/matter';
import {
  type AnimatableProp,
  useAnimatablePoint,
  useAnimatableSpeed,
  useAnimatableUniform,
  useResize,
  useShaderContext,
  useStaticSceneHint,
} from '@lovo/matter-react';
import { atan2, cos, Fn, sin, uniform, uv, vec2, vec3, vec4 } from 'three/tsl';
import { Mesh, MeshBasicNodeMaterial, PlaneGeometry } from 'three/webgpu';

export interface GodRaysShaderProps {
  /**
   * Ray origin, 0..1 across the canvas; `[0.5, 0.5]` is centered and
   * `[0, 0]` is the top-left corner. Values outside 0..1 park the source
   * off-canvas. Accepts a static value or an animation signal.
   */
  center: AnimatableProp<readonly [number, number]>;
  /**
   * Roughly how many rays fit around a full revolution. Higher packs more,
   * thinner rays; lower gives a few broad ones.
   * Accepts a static value or an animation signal.
   */
  density: AnimatableProp<number>;
  /**
   * Overall brightness. 0 hides the rays.
   * Accepts a static value or an animation signal.
   */
  intensity: AnimatableProp<number>;
  /**
   * Shimmer rate — how fast rays swell, fade, and hand brightness to their
   * neighbors. 0 freezes the motion.
   * Accepts a static value or an animation signal.
   */
  speed: AnimatableProp<number>;
}

// Converts the density dial (rays per revolution) into the radius of the
// circle the noise is sampled on. Simplex features are ~1 unit wide, so a
// circle of circumference N passes ~N features per revolution:
// radius = N / (2 * PI).
const DENSITY_TO_CIRCLE = 1 / (2 * Math.PI);

// Noise-space units the pattern morphs per phase unit (phase advances
// ~1/second at speed 1). Higher = busier shimmer.
const SHIMMER_RATE = 0.05;

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

      // The pixel's direction from the origin, in radians, -PI..PI.
      // 0 points right, PI/2 points up (uv's v grows upward).
      const theta = atan2(corrected.y, corrected.x);

      // ---------------------------------------------
      // Ray field — seamless circle embedding
      // ---------------------------------------------
      // Instead of sampling noise along a flat angular axis (which tears
      // where 360° wraps to 0°), sample it ON A CIRCLE inside 3D noise
      // space: the point (cos(theta), sin(theta)) * circleRadius traces a
      // closed loop, so walking a full revolution lands exactly where it
      // started — seamless by construction. The circle's radius sets how
      // many noise features the loop passes, i.e. the ray count; because it
      // is continuous, density can animate freely.
      //
      // The phase rides the third axis: sliding the sampling circle through
      // noise space morphs the pattern IN PLACE — rays swell, fade, and
      // sway, nothing streams outward.
      const circleRadius = densityUniform.mul(DENSITY_TO_CIRCLE);
      const rayCoord = vec3(
        cos(theta).mul(circleRadius),
        sin(theta).mul(circleRadius),
        phaseUniform.mul(SHIMMER_RATE),
      );
      const raw = simplexNoise(rayCoord).mul(0.5).add(0.5);

      const lit = raw.mul(intensityUniform).clamp(0, 1);

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

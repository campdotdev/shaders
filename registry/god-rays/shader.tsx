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
  useAnimatableUniform,
  useResize,
  useShaderContext,
} from '@lovo/matter-react';
import { atan2, Fn, length, uniform, uv, vec2, vec3, vec4 } from 'three/tsl';
import { Mesh, MeshBasicNodeMaterial, PlaneGeometry } from 'three/webgpu';

export interface GodRaysShaderProps {
  /**
   * Ray origin, 0..1 across the canvas; `[0.5, 0.5]` is centered and
   * `[0, 0]` is the top-left corner. Values outside 0..1 park the source
   * off-canvas. Accepts a static value or an animation signal.
   */
  center: AnimatableProp<readonly [number, number]>;
  /**
   * Overall brightness. 0 hides the rays.
   * Accepts a static value or an animation signal.
   */
  intensity: AnimatableProp<number>;
}

// How many rays fit around a full revolution. Placeholder constant until the
// density dial lands in the next phase.
const RAYS_PER_TURN = 12;

export function GodRaysShader({ center, intensity }: GodRaysShaderProps) {
  const shaderContext = useShaderContext();

  const intensityUniform = useAnimatableUniform<number>(intensity);

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
      }
    });
  }, [resize, aspectNode]);

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
      // Ray field (naive — this phase only)
      // ---------------------------------------------
      // Simplex noise sampled along a FLAT angular axis: theta scaled so
      // ~RAYS_PER_TURN noise features fit one revolution (simplex features
      // are ~1 unit wide). Bright noise peaks read as rays. This has a
      // visible seam where theta wraps from PI to -PI — the next phase
      // replaces the flat axis with a circle embedding to fix it.
      // The second axis drifts slowly with distance so a ray varies a little
      // along its length without losing coherence.
      const angularCoord = theta.mul(RAYS_PER_TURN / (2 * Math.PI));
      const raw = simplexNoise(vec2(angularCoord, dist.mul(0.4)))
        .mul(0.5)
        .add(0.5);

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
  }, [shaderContext, intensityUniform, centerUniform, aspectNode]);

  return null;
}

'use client';

// The linear gradient's GPU half. The wrapper (./linear-gradient.tsx) passes
// resolved props down; this component turns them into shader inputs, builds
// a full-screen plane whose color is computed per pixel, and mounts it into
// the shared ShaderScene. The gradient itself is one projection: each pixel's
// position is measured along a direction vector and that distance picks a
// color from the ramp.
import { useEffect } from 'react';

import { colorRamp, type ColorSpace, elapsedTime, type HueInterpolation } from '@lovo/matter';
import {
  type AnimatableProp,
  useAnimatablePoint,
  useAnimatableUniform,
  useShaderContext,
  useStaticSceneHint,
} from '@lovo/matter-react';
import { cos, mix, sin, smoothstep, sub, uv, vec2 } from 'three/tsl';
import { Mesh, MeshBasicNodeMaterial, PlaneGeometry } from 'three/webgpu';

import { type ColorStop, colorStopsKey, toColorRampStops } from '../utils/color';

export interface LinearGradientShaderProps {
  /**
   * Colors along the gradient. Accepts hex, `oklch()`, or `oklab()`;
   * positions auto-space when omitted.
   */
  stops: ColorStop[];
  /**
   * Gradient direction in degrees. 0 runs left to right, 90 runs bottom to
   * top. Accepts a static value or an animation signal.
   */
  angle: AnimatableProp<number>;
  /**
   * Anchor point of the gradient, 0..1 across the canvas; `[0.5, 0.5]` is
   * centered and `[0, 0]` is the top-left corner. The middle of the color
   * ramp sits at the anchor, so moving it slides the whole gradient along
   * its direction. Accepts a static value or an animation signal.
   */
  center: AnimatableProp<readonly [number, number]>;
  /**
   * Speed of the back-and-forth color drift along the gradient. 0 gives a
   * static gradient. Accepts a static value or an animation signal.
   */
  speed: AnimatableProp<number>;
  /** Color space the gradient is interpolated in. */
  colorSpace: ColorSpace;
  /**
   * Hue arc for cylindrical color spaces (oklch/lch/hsl/hsv); inert
   * otherwise.
   */
  hueInterpolation: HueInterpolation;
}

export function LinearGradientShader({
  stops,
  angle,
  center,
  speed,
  colorSpace,
  hueInterpolation,
}: LinearGradientShaderProps) {
  const shaderContext = useShaderContext();

  // A literal speed of 0 means nothing on screen ever changes (an animation
  // signal might move later, so it doesn't count). Telling the scene lets its
  // frame scheduler go idle instead of re-rendering an unchanging image.
  const isStatic = typeof speed === 'number' && speed === 0;

  useStaticSceneHint(isStatic);

  // Content fingerprint of the stops array (colors + positions). The build
  // effect below keys on this string, so a re-render that passes a new array
  // with the same contents doesn't rebuild the material.
  const stopsKey = colorStopsKey(stops);

  // Speed lives in a uniform (a value the CPU can update each frame without
  // rebuilding the shader). useAnimatableUniform keeps it current whether the
  // prop is a static number or an animation signal.
  const speedUniform = useAnimatableUniform<number>(speed);

  // screenOrigin converts the prop's screen-style coordinates (y grows
  // downward, [0, 0] top-left, the way CSS reads) into uv space — the mesh's
  // built-in 0..1 surface coordinates, where v grows upward. Without it,
  // moving the anchor "down" would slide the gradient up.
  const centerUniform = useAnimatablePoint(center, { screenOrigin: true });

  // Angle lives in a scalar uniform; useAnimatableUniform keeps it current
  // whether the prop is a static number or an animation signal. The build
  // effect below derives the direction vector from it in the shader.
  const angleUniform = useAnimatableUniform<number>(angle);

  // ---------------------------------------------
  // Build the material and mount the mesh
  // ---------------------------------------------
  // Runs once per mount — and again only when the stops or color space
  // change, because colorRamp bakes the stop colors into the compiled shader
  // as constants rather than uniforms. Everything else flows through the
  // stable uniforms above without touching this effect.
  useEffect(() => {
    if (!shaderContext) return;

    const rampStops = toColorRampStops(stops);

    // Degrees to radians, then the unit direction. Scalar uniforms are safe
    // as chained receivers, so the multiply reads left to right; the vec2 is
    // built from the results rather than chained off a vec uniform, which is
    // the form gotcha 11 requires.
    const angleRadians = angleUniform.mul(Math.PI / 180);
    const direction = vec2(cos(angleRadians), sin(angleRadians));

    // Project each pixel onto the gradient axis. uv() is the pixel's position
    // on the plane (0..1 both ways); subtracting the anchor and taking the
    // dot product with the unit direction gives a signed distance along that
    // direction — 0 at the anchor, positive ahead of it, negative behind.
    // Adding 0.5 shifts that distance into ramp coordinates, placing the
    // ramp's midpoint at the anchor. With the defaults (centered anchor,
    // angle 0) this reduces to plain left-to-right u: 0 at the left edge,
    // 1 at the right.
    const gradientCoord = uv().sub(centerUniform).dot(direction).add(0.5);

    // Cosine-smoothed ping-pong: (1 - cos(π·x)) / 2 has period 2, peaks at x=1
    // and troughs at x=0/2 — same rhythm as a triangle wave but C∞ smooth so
    // the apex doesn't show as a visible band.
    //
    // The mix(static, animated, smoothstep(0, 0.01, speedUniform)) gates the
    // animation on the GPU: when speedUniform ≤ 0 the mix picks gradientCoord
    // exactly (no S-curve distortion); above ~0.01 it fades into the cosine
    // animation. No JS-side branch, no material rebuild on speed changes.
    const cosineAnimated = sub(
      1,
      cos(gradientCoord.add(elapsedTime.mul(speedUniform)).mul(Math.PI)),
    ).mul(0.5);
    const animatedGradientCoord = mix(
      gradientCoord,
      cosineAnimated,
      smoothstep(0, 0.01, speedUniform),
    );

    // An unlit material whose per-pixel color comes from colorNode (a node
    // graph compiled to GPU code) — colorRamp maps the 0..1 coordinate to a
    // color, interpolating between stops in the chosen color space.
    const material = new MeshBasicNodeMaterial();

    const gradientColor = colorRamp(animatedGradientCoord, rampStops, colorSpace, hueInterpolation);

    material.colorNode = gradientColor;

    // A 2x2 plane exactly fills ShaderScene's camera view (-1..1 across both
    // axes), so the gradient covers the whole canvas.
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
    // stopsKey is a stable string proxy for the stops array; the array itself
    // is intentionally omitted to avoid rebuilds on identity-only changes.
    // Animatable uniforms are mutated in place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    shaderContext,
    stopsKey,
    speedUniform,
    centerUniform,
    angleUniform,
    colorSpace,
    hueInterpolation,
  ]);

  return null;
}

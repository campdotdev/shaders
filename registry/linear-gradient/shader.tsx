'use client';

import { useEffect, useMemo } from 'react';

import { colorRamp, type ColorSpace, elapsedTime, type HueInterpolation } from '@lovo/matter';
import {
  type AnimatableProp,
  useAnimatableUniform,
  useShaderContext,
  useStaticSceneHint,
} from '@lovo/matter-react';
import { cos, mix, smoothstep, sub, uniform, uv } from 'three/tsl';
import { Mesh, MeshBasicNodeMaterial, PlaneGeometry, Vector2 } from 'three/webgpu';

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
   * Anchor point of the gradient in normalized UV; `[0.5, 0.5]` is centered.
   * The point on screen where the first color stop sits. Accepts a static
   * value or an animation signal.
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

const isPoint = (value: unknown): value is readonly [number, number] =>
  Array.isArray(value) &&
  value.length === 2 &&
  typeof value[0] === 'number' &&
  typeof value[1] === 'number';

export function LinearGradientShader({
  stops,
  angle,
  center,
  speed,
  colorSpace,
  hueInterpolation,
}: LinearGradientShaderProps) {
  const shaderContext = useShaderContext();

  const isStatic = typeof speed === 'number' && speed === 0;

  useStaticSceneHint(isStatic);

  const stopsKey = colorStopsKey(stops);

  const speedUniform = useAnimatableUniform<number>(speed);

  const centerVec = useMemo(() => new Vector2(0.5, 0.5), []);
  const centerUniform = useMemo(() => uniform(centerVec), [centerVec]);

  const dirVec = useMemo(() => new Vector2(1, 0), []);
  const dirNode = useMemo(() => uniform(dirVec), [dirVec]);

  useEffect(() => {
    const angleValue = typeof angle === 'number' ? angle : 0;
    const angleRadians = angleValue * (Math.PI / 180);

    dirVec.set(Math.cos(angleRadians), Math.sin(angleRadians));
    shaderContext?.scheduler.requestRender();
  }, [shaderContext, dirVec, angle]);

  useEffect(() => {
    if (isPoint(center)) {
      centerVec.set(center[0], 1 - center[1]);
    } else {
      centerVec.set(0.5, 0.5);
    }
    shaderContext?.scheduler.requestRender();
  }, [shaderContext, centerVec, center]);

  useEffect(() => {
    if (!shaderContext) return;

    const rampStops = toColorRampStops(stops);

    const gradientCoord = uv().sub(centerUniform).dot(dirNode).add(0.5);

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

    const material = new MeshBasicNodeMaterial();

    const gradientColor = colorRamp(animatedGradientCoord, rampStops, colorSpace, hueInterpolation);

    material.colorNode = gradientColor;

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
  }, [shaderContext, stopsKey, speedUniform, centerUniform, dirNode, colorSpace, hueInterpolation]);

  return null;
}

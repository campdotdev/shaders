'use client';

import { useEffect, useMemo } from 'react';

import { colorRamp, type ColorSpace, elapsedTime, type HueInterpolation } from '@lovo/matter';
import {
  type AnimatableProp,
  useAnimatableUniform,
  useCursor,
  useShaderContext,
  useStaticSceneHint,
} from '@lovo/matter-react';
import { cos, mix, smoothstep, sub, uniform, uv } from 'three/tsl';
import { Mesh, MeshBasicNodeMaterial, PlaneGeometry, Vector2 } from 'three/webgpu';

import { type ColorStop, colorStopsKey, toColorRampStops } from '../utils/color';

export interface LinearGradientShaderProps {
  stops: ColorStop[];
  angle: AnimatableProp<number>;
  focalPoint: AnimatableProp<readonly [number, number]>;
  speed: AnimatableProp<number>;
  interactive: boolean;
  colorSpace: ColorSpace;
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
  focalPoint,
  speed,
  interactive,
  colorSpace,
  hueInterpolation,
}: LinearGradientShaderProps) {
  const shaderContext = useShaderContext();
  const cursorAuto = useCursor();
  const cursor = interactive ? cursorAuto : null;

  const isStatic = typeof speed === 'number' && speed === 0;

  useStaticSceneHint(isStatic);

  const stopsKey = colorStopsKey(stops);

  const speedUniform = useAnimatableUniform<number>(speed);

  const cursorVec = useMemo(() => new Vector2(0.5, 0.5), []);
  const cursorUniform = useMemo(() => uniform(cursorVec), [cursorVec]);

  const dirVec = useMemo(() => new Vector2(1, 0), []);
  const dirNode = useMemo(() => uniform(dirVec), [dirVec]);

  useEffect(() => {
    const angleValue = typeof angle === 'number' ? angle : 0;
    const angleRadians = angleValue * (Math.PI / 180);

    dirVec.set(Math.cos(angleRadians), Math.sin(angleRadians));
    shaderContext?.scheduler.requestRender();
  }, [shaderContext, dirVec, angle]);

  useEffect(() => {
    if (cursor) {
      return cursor.on('change', ([cursorX, cursorY]) => {
        cursorVec.set(cursorX, 1 - cursorY);
        shaderContext?.scheduler.requestRender();
      });
    }

    if (isPoint(focalPoint)) {
      cursorVec.set(focalPoint[0], 1 - focalPoint[1]);
    } else {
      cursorVec.set(0.5, 0.5);
    }
    shaderContext?.scheduler.requestRender();

    return undefined;
  }, [shaderContext, cursor, cursorVec, focalPoint]);

  useEffect(() => {
    if (!shaderContext) return;

    const rampStops = toColorRampStops(stops);

    const gradientCoord = uv().sub(cursorUniform).dot(dirNode).add(0.5);

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
      material.dispose();
      mesh.geometry.dispose();
    };
    // stopsKey is a stable string proxy for the stops array; the array itself
    // is intentionally omitted to avoid rebuilds on identity-only changes.
    // Animatable uniforms are mutated in place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    shaderContext,
    stopsKey,
    cursor,
    speedUniform,
    cursorUniform,
    dirNode,
    colorSpace,
    hueInterpolation,
  ]);

  return null;
}

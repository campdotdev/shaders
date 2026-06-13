'use client';

import { useEffect, useMemo } from 'react';

import { colorRamp, type ColorRampStop, elapsedTime } from '@lovo/matter';
import {
  type AnimatableProp,
  useAnimatableUniform,
  useCursor,
  useShaderContext,
  useStaticHint,
} from '@lovo/matter-react';
import { cos, mix, smoothstep, sub, uniform, uv, vec3 } from 'three/tsl';
import { Mesh, MeshBasicNodeMaterial, PlaneGeometry, Vector2 } from 'three/webgpu';

import { parseHex } from '../utils/color';

export interface LinearGradientShaderProps {
  colors: string[];
  stops: number[] | undefined;
  angle: AnimatableProp<number>;
  focalPoint: AnimatableProp<readonly [number, number]>;
  speed: AnimatableProp<number>;
  interactive: boolean;
}

const isPoint = (value: unknown): value is readonly [number, number] =>
  Array.isArray(value) &&
  value.length === 2 &&
  typeof value[0] === 'number' &&
  typeof value[1] === 'number';

export function LinearGradientShader({
  colors,
  stops,
  angle,
  focalPoint,
  speed,
  interactive,
}: LinearGradientShaderProps) {
  const shaderContext = useShaderContext();
  const cursorAuto = useCursor();
  const cursor = interactive ? cursorAuto : null;

  const isStatic = typeof speed === 'number' && speed === 0;

  useStaticHint(isStatic);

  const colorsKey = colors.join('|');
  const stopsKey = stops?.join('|') ?? '';

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

    const evenAt = (colorIndex: number) => colorIndex / Math.max(colors.length - 1, 1);

    const rampStops: ColorRampStop[] = colors.map((hex, colorIndex) => {
      const [redChannel, greenChannel, blueChannel] = parseHex(hex);
      const userPos = stops?.[colorIndex];
      const position =
        typeof userPos === 'number' ? Math.min(Math.max(userPos, 0), 1) : evenAt(colorIndex);

      return {
        color: vec3(redChannel, greenChannel, blueChannel),
        position,
      };
    });

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

    material.colorNode = colorRamp(animatedGradientCoord, rampStops);

    const mesh = new Mesh(new PlaneGeometry(2, 2), material);

    shaderContext.scene.add(mesh);

    return () => {
      shaderContext.scene.remove(mesh);

      try {
        material.dispose();
      } catch (caughtError) {
        console.debug('[LinearGradient] material.dispose ignored:', caughtError);
      }
      try {
        mesh.geometry.dispose();
      } catch (caughtError) {
        console.debug('[LinearGradient] geometry.dispose ignored:', caughtError);
      }
    };
    // colorsKey and stopsKey are stable string proxies for the prop arrays;
    // the arrays themselves are intentionally omitted to avoid rebuilds on
    // identity-only changes. Animatable uniforms are mutated in place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shaderContext, colorsKey, stopsKey, cursor, speedUniform, cursorUniform, dirNode]);

  return null;
}

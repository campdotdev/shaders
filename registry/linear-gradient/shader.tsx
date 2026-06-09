'use client';

import { useEffect, useMemo } from 'react';

import { colorRamp, type ColorRampStop, time } from '@lovo/matter';
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

const isPoint = (v: unknown): v is readonly [number, number] =>
  Array.isArray(v) && v.length === 2 && typeof v[0] === 'number' && typeof v[1] === 'number';

export function LinearGradientShader({
  colors,
  stops,
  angle,
  focalPoint,
  speed,
  interactive,
}: LinearGradientShaderProps) {
  const ctx = useShaderContext();
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
    const rad = angleValue * (Math.PI / 180);

    dirVec.set(Math.cos(rad), Math.sin(rad));
    ctx?.scheduler.requestRender();
  }, [ctx, dirVec, angle]);

  useEffect(() => {
    if (cursor) {
      return cursor.on('change', ([x, y]) => {
        cursorVec.set(x, 1 - y);
        ctx?.scheduler.requestRender();
      });
    }

    if (isPoint(focalPoint)) {
      cursorVec.set(focalPoint[0], 1 - focalPoint[1]);
    } else {
      cursorVec.set(0.5, 0.5);
    }
    ctx?.scheduler.requestRender();

    return undefined;
  }, [ctx, cursor, cursorVec, focalPoint]);

  useEffect(() => {
    if (!ctx) return;

    const evenAt = (i: number) => i / Math.max(colors.length - 1, 1);

    const rampStops: ColorRampStop[] = colors.map((hex, i) => {
      const [r, g, b] = parseHex(hex);
      const userPos = stops?.[i];
      const position = typeof userPos === 'number' ? Math.min(Math.max(userPos, 0), 1) : evenAt(i);

      return {
        color: vec3(r, g, b),
        position,
      };
    });

    const tNode = uv().sub(cursorUniform).dot(dirNode).add(0.5);

    // Cosine-smoothed ping-pong: (1 - cos(π·x)) / 2 has period 2, peaks at x=1
    // and troughs at x=0/2 — same rhythm as a triangle wave but C∞ smooth so
    // the apex doesn't show as a visible band.
    //
    // The mix(static, animated, smoothstep(0, 0.01, speedU)) gates the
    // animation on the GPU: when speedU ≤ 0 the mix picks tNode exactly (no
    // S-curve distortion); above ~0.01 it fades into the cosine animation.
    // No JS-side branch, no material rebuild on speed changes.
    const cosineAnimated = sub(1, cos(tNode.add(time.mul(speedUniform)).mul(Math.PI))).mul(0.5);
    const tAnimated = mix(tNode, cosineAnimated, smoothstep(0, 0.01, speedUniform));

    const material = new MeshBasicNodeMaterial();

    material.colorNode = colorRamp(tAnimated, rampStops);

    const mesh = new Mesh(new PlaneGeometry(2, 2), material);

    ctx.scene.add(mesh);

    return () => {
      ctx.scene.remove(mesh);

      try {
        material.dispose();
      } catch (err) {
        console.debug('[LinearGradient] material.dispose ignored:', err);
      }
      try {
        mesh.geometry.dispose();
      } catch (err) {
        console.debug('[LinearGradient] geometry.dispose ignored:', err);
      }
    };
    // colorsKey and stopsKey are stable string proxies for the prop arrays;
    // the arrays themselves are intentionally omitted to avoid rebuilds on
    // identity-only changes. Animatable uniforms are mutated in place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, colorsKey, stopsKey, cursor, speedUniform, cursorUniform, dirNode]);

  return null;
}

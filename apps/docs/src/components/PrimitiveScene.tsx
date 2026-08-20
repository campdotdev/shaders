'use client';

import { useEffect, useMemo } from 'react';

import {
  colorRamp,
  type ColorRampStop,
  cursorRipple,
  displace,
  elapsedTime,
  fractalNoise,
  mixColor,
  quantize,
  signedDistanceFieldCircle,
  simplexNoise,
  voronoi,
} from '@mattermix/shaders';
import { ShaderScene, useShaderContext } from '@mattermix/shaders-react';
import type { ShaderNodeObject } from 'three/tsl';
import { mix, sin, smoothstep, uniform, uv, vec2, vec3, vec4 } from 'three/tsl';
import { Vector2 } from 'three/webgpu';
import type { Node } from 'three/webgpu';

import { addPlaneMesh } from '@/lib/meshUtils';

import type { PrimitiveParams } from './primitive-params';

// Per-variant alias so builder signatures stay short.
type ParamsFor<S extends PrimitiveParams['slug']> = Extract<PrimitiveParams, { slug: S }>;

interface PrimitiveSceneProps {
  primitive: PrimitiveParams;
}

const buildStructuralKey = (primitive: PrimitiveParams): string =>
  JSON.stringify(primitive, Object.keys(primitive).sort());

// === Primitive demo builders ===

function buildColorRamp(params: ParamsFor<'color-ramp'>): ShaderNodeObject<Node> {
  const stops: ColorRampStop[] = [
    { color: vec3(1, 0.4, 0.4), position: 0 },
    { color: vec3(0.4, 1, 0.4), position: 0.5 },
    { color: vec3(0.4, 0.4, 1), position: 1 },
  ];

  const baseColor = colorRamp(uv().x, stops);
  const distFromMarker = uv().x.sub(params.position).abs();
  const marker = smoothstep(0.01, 0, distFromMarker);

  const lit = mix(baseColor, vec3(1, 1, 1), marker.mul(0.6));

  return vec4(lit, 1);
}

function buildMixColor(params: ParamsFor<'mix-color'>): ShaderNodeObject<Node> {
  const mixed = mixColor(vec3(1, 0.2, 0.1), vec3(0.15, 0.35, 1), uv().x);
  const distFromMarker = uv().x.sub(params.t).abs();
  const marker = smoothstep(0.01, 0, distFromMarker);
  const lit = mix(mixed, vec3(1, 1, 1), marker.mul(0.6));

  return vec4(lit, 1);
}

function buildNoise(params: ParamsFor<'noise'>): ShaderNodeObject<Node> {
  const scaledTime = elapsedTime.mul(params.speed);
  const samplePosition = uv().mul(params.scale).add(vec2(scaledTime, scaledTime));
  const noiseValue = simplexNoise(samplePosition);
  // noise returns ~[-1, 1]; map to [0, 1] grayscale.
  const grayscale = noiseValue.mul(0.5).add(0.5).clamp(0, 1);

  return vec4(grayscale, grayscale, grayscale, 1);
}

function buildFbm(params: ParamsFor<'fbm'>): ShaderNodeObject<Node> {
  const scaledTime = elapsedTime.mul(params.speed);
  const samplePosition = uv().mul(params.scale).add(vec2(scaledTime, scaledTime));
  const noiseValue = fractalNoise(samplePosition, {
    octaves: params.octaves,
    lacunarity: params.lacunarity,
    gain: params.gain,
  });
  const grayscale = noiseValue.mul(0.5).add(0.5).clamp(0, 1);

  return vec4(grayscale, grayscale, grayscale, 1);
}

function buildVoronoi(params: ParamsFor<'voronoi'>): ShaderNodeObject<Node> {
  const scaledTime = elapsedTime.mul(params.speed);
  const samplePosition = uv().mul(params.scale).add(vec2(scaledTime, scaledTime));
  const voronoiValue = voronoi(samplePosition);
  // voronoi (mx_worley_noise_float) is roughly [0, 1]; clamp to be safe.
  const grayscale = voronoiValue.clamp(0, 1);

  return vec4(grayscale, grayscale, grayscale, 1);
}

function buildQuantize(params: ParamsFor<'quantize'>): ShaderNodeObject<Node> {
  const bins = Math.max(2, Math.round(params.bins));
  const quantizedValue = quantize(uv().x, bins);
  const stops: ColorRampStop[] = [
    { color: vec3(0.15, 0.2, 0.4), position: 0 },
    { color: vec3(0.6, 0.4, 0.9), position: 0.5 },
    { color: vec3(1, 0.7, 0.4), position: 1 },
  ];
  const rampColor = colorRamp(quantizedValue, stops);

  return vec4(rampColor, 1);
}

function buildSdfCircle(params: ParamsFor<'sdf-circle'>): ShaderNodeObject<Node> {
  const samplePosition = uv().sub(vec2(params.cx, params.cy));
  const sdf = signedDistanceFieldCircle(samplePosition, params.radius);
  const antialiasWidth = 0.005;
  const mask = smoothstep(antialiasWidth, -antialiasWidth, sdf);
  const mixedColor = mix(vec3(0.05, 0.05, 0.1), vec3(1, 1, 1), mask);

  return vec4(mixedColor, 1);
}

function buildDisplace(params: ParamsFor<'displace'>): ShaderNodeObject<Node> {
  const scaledTime = elapsedTime.mul(0.2);
  const displacedUv = displace(uv(), vec2(params.x, params.y));
  const samplePoint = displacedUv.mul(4).add(vec2(scaledTime, scaledTime));
  const noiseValue = simplexNoise(samplePoint);
  const grayscale = noiseValue.mul(0.5).add(0.5).clamp(0, 1);

  return vec4(grayscale, grayscale, grayscale, 1);
}

function buildCursorRipple(
  params: ParamsFor<'cursor-ripple'>,
  staticCursor: Parameters<typeof cursorRipple>[1],
): ShaderNodeObject<Node> {
  const reach = 1 / params.falloff;
  const frequency = params.falloff * 8;
  const ripple = cursorRipple(uv(), staticCursor, {
    amplitude: params.amplitude,
    frequency,
    reach,
    speed: params.speed * 6,
  });
  const grayscale = ripple
    .div(params.amplitude * 2 + 0.0001)
    .add(0.5)
    .clamp(0, 1);

  return vec4(grayscale, grayscale, grayscale, 1);
}

function buildTime(): ShaderNodeObject<Node> {
  // No controls. sin(time * 2) → [-1, 1] → grayscale pulse.
  const pulse = sin(elapsedTime.mul(2)).mul(0.5).add(0.5);

  return vec4(pulse, pulse, pulse, 1);
}

export function PrimitiveScene({ primitive }: PrimitiveSceneProps) {
  const remountKey = buildStructuralKey(primitive);

  return (
    <ShaderScene>
      <PrimitiveMesh key={remountKey} primitive={primitive} />
    </ShaderScene>
  );
}

function PrimitiveMesh({ primitive }: PrimitiveSceneProps) {
  const shaderContext = useShaderContext();

  const staticCursorVec = useMemo(() => new Vector2(0.5, 0.5), []);
  const staticCursor = useMemo(() => uniform(staticCursorVec), [staticCursorVec]);

  useEffect(() => {
    if (!shaderContext) return;

    let colorNode: ShaderNodeObject<Node>;

    switch (primitive.slug) {
      case 'color-ramp':
        colorNode = buildColorRamp(primitive);
        break;
      case 'mix-color':
        colorNode = buildMixColor(primitive);
        break;
      case 'noise':
        colorNode = buildNoise(primitive);
        break;
      case 'fbm':
        colorNode = buildFbm(primitive);
        break;
      case 'voronoi':
        colorNode = buildVoronoi(primitive);
        break;
      case 'quantize':
        colorNode = buildQuantize(primitive);
        break;
      case 'sdf-circle':
        colorNode = buildSdfCircle(primitive);
        break;
      case 'displace':
        colorNode = buildDisplace(primitive);
        break;
      case 'cursor-ripple':
        colorNode = buildCursorRipple(primitive, staticCursor);
        break;
      case 'time':
        colorNode = buildTime();
        break;
      default: {
        const _exhaustive: never = primitive;

        throw new Error(`Unhandled primitive variant: ${JSON.stringify(_exhaustive)}`);
      }
    }

    return addPlaneMesh(shaderContext, colorNode);
  }, [shaderContext, primitive, staticCursor]);

  return null;
}

import {
  colorRamp,
  type ColorRampStop,
  elapsedTime,
  fractionalBrownianMotion,
  quantize,
  voronoi,
} from '@lovo/matter';
import type UniformNode from 'three/src/nodes/core/UniformNode.js';
import { length, max, sin, smoothstep, uv, vec2, vec3, vec4 } from 'three/tsl';
import type { ShaderNodeObject } from 'three/tsl';
import type { Node } from 'three/webgpu';
import type { Vector2 } from 'three/webgpu';

export type RecipeBuild = (deps: {
  cursorUniform: ShaderNodeObject<UniformNode<Vector2>>;
}) => ShaderNodeObject<Node>;

/** Shared tail for all animated-stripes variants: same 2-stop ramp, sin→normalizedStripe→colorRamp→vec4. */
function stripeOutput(phase: ShaderNodeObject<Node>): ShaderNodeObject<Node> {
  const stripe = sin(phase) as ShaderNodeObject<Node>;
  const normalizedStripe = stripe.mul(0.5).add(0.5).clamp(0, 1) as ShaderNodeObject<Node>;
  const stops: ColorRampStop[] = [
    { color: vec3(1, 0.5, 0.4), position: 0 },
    { color: vec3(0.4, 0.6, 1), position: 1 },
  ];
  const rampColor = colorRamp(normalizedStripe, stops);

  return vec4(rampColor, 1);
}

/** Shared FBM base for plasma variants: time-driven uv drift → normalized 0..1. */
function plasmaBase(): ShaderNodeObject<Node> {
  const scrolledTime = elapsedTime.mul(0.3);
  const samplePosition = (uv() as ShaderNodeObject<Node>)
    .mul(2)
    .add(vec2(scrolledTime, scrolledTime)) as ShaderNodeObject<Node>;

  return fractionalBrownianMotion(samplePosition, { octaves: 4 }).mul(0.5).add(0.5).clamp(0, 1);
}

export const RECIPE_BUILDS: Record<string, RecipeBuild> = {
  // ─── animated-stripes ─────────────────────────────────────────────────

  'animated-stripes.canonical': () => {
    const scrolledTime = elapsedTime.mul(2);
    const phase = (uv() as ShaderNodeObject<Node>).x
      .mul(20)
      .add(scrolledTime) as ShaderNodeObject<Node>;

    return stripeOutput(phase);
  },

  'animated-stripes.diagonal': () => {
    const scrolledTime = elapsedTime.mul(2);
    const yPhase = (uv() as ShaderNodeObject<Node>).y.mul(8) as ShaderNodeObject<Node>;
    const phase = (uv() as ShaderNodeObject<Node>).x
      .mul(20)
      .add(yPhase)
      .add(scrolledTime) as ShaderNodeObject<Node>;

    return stripeOutput(phase);
  },

  'animated-stripes.pulse': () => {
    const pulseTime = sin(elapsedTime).mul(2) as ShaderNodeObject<Node>;
    const phase = (uv() as ShaderNodeObject<Node>).x
      .mul(8)
      .add(pulseTime) as ShaderNodeObject<Node>;

    return stripeOutput(phase);
  },

  // ─── cursor-glow ──────────────────────────────────────────────────────

  'cursor-glow.circular': ({ cursorUniform }) => {
    const offset = (uv() as ShaderNodeObject<Node>).sub(cursorUniform) as ShaderNodeObject<Node>;
    const distance = length(offset) as ShaderNodeObject<Node>;
    const glow = smoothstep(0.3, 0, distance) as ShaderNodeObject<Node>;

    return vec4(glow, glow.mul(0.7), glow.mul(1.5), 1);
  },

  'cursor-glow.square': ({ cursorUniform }) => {
    const dx = (uv() as ShaderNodeObject<Node>).x
      .sub(cursorUniform.x)
      .abs() as ShaderNodeObject<Node>;
    const dy = (uv() as ShaderNodeObject<Node>).y
      .sub(cursorUniform.y)
      .abs() as ShaderNodeObject<Node>;
    const distance = max(dx, dy) as ShaderNodeObject<Node>;
    const glow = smoothstep(0.3, 0, distance) as ShaderNodeObject<Node>;

    return vec4(glow, glow.mul(0.7), glow.mul(1.5), 1);
  },

  'cursor-glow.pinpoint': ({ cursorUniform }) => {
    const offset = (uv() as ShaderNodeObject<Node>).sub(cursorUniform) as ShaderNodeObject<Node>;
    const distance = length(offset) as ShaderNodeObject<Node>;
    const glow = smoothstep(0.1, 0, distance) as ShaderNodeObject<Node>;

    return vec4(glow, glow, glow, 1);
  },

  // ─── plasma ───────────────────────────────────────────────────────────

  'plasma.canonical': () => {
    const fbmValue = plasmaBase();
    const stops: ColorRampStop[] = [
      { color: vec3(0.4, 0, 0.8), position: 0 },
      { color: vec3(1, 0.4, 0.6), position: 0.5 },
      { color: vec3(0.4, 0.9, 1), position: 1 },
    ];
    const rampColor = colorRamp(fbmValue, stops);

    return vec4(rampColor, 1);
  },

  'plasma.monochrome-marble': () => {
    const fbmValue = plasmaBase();
    const stops: ColorRampStop[] = [
      { color: vec3(0.05, 0.05, 0.1), position: 0 },
      { color: vec3(0.85, 0.85, 0.9), position: 1 },
    ];
    const rampColor = colorRamp(fbmValue, stops);

    return vec4(rampColor, 1);
  },

  // ─── cellular-tiles ───────────────────────────────────────────────────

  'cellular-tiles.canonical': () => {
    const samplePosition = (uv() as ShaderNodeObject<Node>).mul(8) as ShaderNodeObject<Node>;
    const cells = voronoi(samplePosition);
    const tiered = quantize(cells, 4);

    return vec4(tiered, tiered.mul(0.7), tiered.mul(0.5), 1);
  },

  'cellular-tiles.coarse-mosaic': () => {
    const samplePosition = (uv() as ShaderNodeObject<Node>).mul(4) as ShaderNodeObject<Node>;
    const cells = voronoi(samplePosition);
    const tiered = quantize(cells, 3);

    return vec4(tiered.mul(0.6), tiered.mul(0.7), tiered, 1);
  },

  'cellular-tiles.fine-stained-glass': () => {
    const samplePosition = (uv() as ShaderNodeObject<Node>).mul(14) as ShaderNodeObject<Node>;
    const cells = voronoi(samplePosition);
    const tiered = quantize(cells, 8);
    const stops: ColorRampStop[] = [
      { color: vec3(0.5, 0.05, 0.3), position: 0 }, // ruby
      { color: vec3(0.1, 0.2, 0.6), position: 0.33 }, // sapphire
      { color: vec3(0.05, 0.5, 0.4), position: 0.66 }, // emerald
      { color: vec3(0.9, 0.75, 0.2), position: 1 }, // amber
    ];
    const rampColor = colorRamp(tiered, stops);

    return vec4(rampColor, 1);
  },
};

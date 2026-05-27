'use client';

import { useEffect, useMemo } from 'react';
import {
  Mesh,
  MeshBasicNodeMaterial,
  PlaneGeometry,
  Vector2,
  Vector3,
} from 'three/webgpu';
import type { Node } from 'three/webgpu';
import {
  uv,
  vec2,
  vec4,
  mix,
  sign,
  abs,
  pow,
  sin,
  cos,
  smoothstep,
  uniform,
  type ShaderNodeObject,
} from 'three/tsl';

import { time, noise } from '@lovo/matter';
import {
  useMatterContext,
  useResize,
  useAnimatableUniform,
  type AnimatableProp,
} from '@lovo/matter-react';

import { parseHex } from '../utils/color';

export interface MeshGradientShaderProps {
  /** Global animation rate. Multiplies the time the warp uses. */
  speed: AnimatableProp<number>;
  /** Sine warp frequency. Higher = more wobbles per gradient. */
  frequency: AnimatableProp<number>;
  /** Sine warp amplitude divisor. Higher = subtler wobble. */
  amplitude: AnimatableProp<number>;
  /** Palette A ↔ B crossfade rate. 0 = freeze, higher = faster. */
  cycleSpeed: AnimatableProp<number>;
  /** Crossfade shape. <1 = linger at extremes, 1 = pure sine, >1 = linger at midpoint. Default 0.6. */
  cycleEase: AnimatableProp<number>;
  /** Light palette: 4 hex strings. */
  paletteA: [string, string, string, string];
  /** Dark palette: 4 hex strings. */
  paletteB: [string, string, string, string];
}

// -5° in radians; baked into the layer-x sample rotation. Could be promoted
// to a prop later, but is fine as a stylistic constant for now.
const LAYER_ROT_RAD = (-5 * Math.PI) / 180;

function useColorUniform(hex: string) {
  const vec = useMemo(() => {
    const [r, g, b] = parseHex(hex);
    return new Vector3(r, g, b);
  }, [hex]);

  const node = useMemo(() => uniform(vec), [vec]);

  useEffect(() => {
    const [r, g, b] = parseHex(hex);
    vec.set(r, g, b);
  }, [hex, vec]);

  return node;
}

export function MeshGradientShader(props: MeshGradientShaderProps) {
  const ctx = useMatterContext();
  const resize = useResize();

  const cycleSpeedU = useAnimatableUniform<number>(props.cycleSpeed);
  const cycleEaseU = useAnimatableUniform<number>(props.cycleEase);

  const a0 = useColorUniform(props.paletteA[0]);
  const a1 = useColorUniform(props.paletteA[1]);
  const a2 = useColorUniform(props.paletteA[2]);
  const a3 = useColorUniform(props.paletteA[3]);
  const b0 = useColorUniform(props.paletteB[0]);
  const b1 = useColorUniform(props.paletteB[1]);
  const b2 = useColorUniform(props.paletteB[2]);
  const b3 = useColorUniform(props.paletteB[3]);

  const speedU = useAnimatableUniform<number>(props.speed);
  const frequencyU = useAnimatableUniform<number>(props.frequency);
  const amplitudeU = useAnimatableUniform<number>(props.amplitude);

  // Resolution uniform — drives aspect correction. Seed with a sane large
  // default so the first frame doesn't see (1, 1). Pattern from Aurora.
  const resVec = useMemo(() => new Vector2(1920, 1080), []);
  const resNode = useMemo(
    () => uniform(resVec) as unknown as ShaderNodeObject<Node>,
    [resVec],
  );
  useEffect(() => {
    const [w, h] = resize.get();
    if (w > 0 && h > 0) resVec.set(w, h);
    return resize.on('change', ([w2, h2]) => resVec.set(w2, h2));
  }, [resize, resVec]);

  useEffect(() => {
    if (!ctx) return;

    // ---- Centered UVs --------------------------------------------------
    // tuv = uv - 0.5  puts (0,0) at the center, range [-0.5, 0.5].
    const tuvRaw = uv().sub(vec2(0.5, 0.5));

    // ---- Noise-driven rotation angle ----------------------------------
    // ShaderToy uses noise(vec2(time*0.05, tuv.x*tuv.y)) which is per-pixel
    // (rotation varies across the screen). Engine noise returns ~[-1, 1];
    // remap to [0, 1] to match the source.
    const tSlow = time.mul(0.05);
    const noiseInput = vec2(tSlow, tuvRaw.x.mul(tuvRaw.y));
    const degree01 = noise(noiseInput).mul(0.5).add(0.5); // [0, 1]
    // angle = (degree01 - 0.5) * (720° in radians) + 180° in radians
    //       = (degree01 - 0.5) * 4π + π
    const TWO_TURNS_RAD = Math.PI * 4;
    const ROT_BIAS_RAD = Math.PI;
    const angle = degree01.sub(0.5).mul(TWO_TURNS_RAD).add(ROT_BIAS_RAD);

    // ---- Aspect-corrected rotation -----------------------------------
    // Pre-divide y by aspect so the rotation operates in unit space, then
    // restore y after. (CLAUDE.md gotcha #12: `.x` produces a fresh node
    // derived from the resNode uniform, which then safely participates
    // in further chains.)
    const aspect = resNode.x.div(resNode.y);
    const ty = tuvRaw.y.div(aspect);
    const c = cos(angle);
    const s = sin(angle);
    // Componentwise rotation: (x', y') = (c*x - s*y, s*x + c*y).
    const rx = tuvRaw.x.mul(c).sub(ty.mul(s));
    const ryUnit = tuvRaw.x.mul(s).add(ty.mul(c));
    const ry = ryUnit.mul(aspect);
    const tuvRotated = vec2(rx, ry);

    // ---- Sine domain warp --------------------------------------------
    // Push each pixel by a sine of its own coordinates. The y-axis uses
    // 1.5x frequency and 2x amplitude (relative to x) to de-correlate the
    // two warps so the result doesn't look like a single shear.
    const tspeed = time.mul(speedU);
    const warpX = sin(tuvRotated.y.mul(frequencyU).add(tspeed)).div(amplitudeU);
    const warpY = sin(tuvRotated.x.mul(frequencyU).mul(1.5).add(tspeed))
      .div(amplitudeU)
      .mul(2);
    const tuv = vec2(tuvRotated.x.add(warpX), tuvRotated.y.add(warpY));

    // ---- Time-cycling palette ----------------------------------------
    // c = sin(time * cycleSpeed)        smooth oscillator in [-1, 1]
    // eased = (sign(c) * |c|^cycleEase + 1) / 2
    //                                   S-curve in [0, 1]. cycleEase < 1
    //                                   lingers at ±1 (palettes A and B);
    //                                   cycleEase = 1 is a pure sine;
    //                                   cycleEase > 1 lingers at the
    //                                   midpoint.
    const cycleTime = time.mul(cycleSpeedU);
    const cycle = sin(cycleTime);
    const eased = sign(cycle)
      .mul(pow(abs(cycle), cycleEaseU))
      .add(1)
      .mul(0.5);

    const color0 = mix(a0, b0, eased);
    const color1 = mix(a1, b1, eased);
    const color2 = mix(a2, b2, eased);
    const color3 = mix(a3, b3, eased);

    // ---- Two-layer smoothstep blend ---------------------------------
    // Sample tuv through a small additional rotation (-5°) and use the
    // resulting x to pick a smooth horizontal gradient per "layer". The
    // vertical blend uses un-rotated tuv.y. Reversed smoothstep edges
    // (0.5 -> -0.3) flip the direction so top of canvas reads layer1.
    const lc = Math.cos(LAYER_ROT_RAD);
    const ls = Math.sin(LAYER_ROT_RAD);
    const layerX = tuv.x.mul(lc).sub(tuv.y.mul(ls));

    const hMix = smoothstep(-0.3, 0.2, layerX);
    const layer1 = color2.mul(hMix.oneMinus()).add(color1.mul(hMix));
    const layer2 = color3.mul(hMix.oneMinus()).add(color0.mul(hMix));

    const vMix = smoothstep(0.5, -0.3, tuv.y);
    const color = layer1.mul(vMix.oneMinus()).add(layer2.mul(vMix));

    const material = new MeshBasicNodeMaterial();
    material.colorNode = vec4(color, 1);

    const mesh = new Mesh(new PlaneGeometry(2, 2), material);
    ctx.scene.add(mesh);
    return () => {
      ctx.scene.remove(mesh);
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
  }, [
    ctx,
    resNode,
    speedU,
    frequencyU,
    amplitudeU,
    cycleSpeedU,
    cycleEaseU,
    a0,
    a1,
    a2,
    a3,
    b0,
    b1,
    b2,
    b3,
  ]);

  return null;
}

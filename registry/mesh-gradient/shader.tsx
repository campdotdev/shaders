'use client';

import { useEffect, useMemo } from 'react';

import { noise, time } from '@lovo/matter';
import {
  type AnimatableProp,
  useAnimatableUniform,
  useResize,
  useShaderContext,
} from '@lovo/matter-react';
import { abs, cos, mix, pow, sign, sin, smoothstep, uniform, uv, vec2, vec4 } from 'three/tsl';
import { Mesh, MeshBasicNodeMaterial, PlaneGeometry, Vector2, Vector3 } from 'three/webgpu';

import { parseHex } from '../utils/color';

export interface MeshGradientShaderProps {
  speed: AnimatableProp<number>;
  frequency: AnimatableProp<number>;
  amplitude: AnimatableProp<number>;
  cycleSpeed: AnimatableProp<number>;
  cycleEase: AnimatableProp<number>;
  paletteA: [string, string, string, string];
  paletteB: [string, string, string, string];
}

const LAYER_ROT_RAD = (-5 * Math.PI) / 180;

function useColorUniform(hex: string) {
  const vec = useMemo(
    () => {
      const [r, g, b] = parseHex(hex);

      return new Vector3(r, g, b);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const node = useMemo(() => uniform(vec), [vec]);

  useEffect(() => {
    const [r, g, b] = parseHex(hex);

    vec.set(r, g, b);
  }, [hex, vec]);

  return node;
}

export function MeshGradientShader({
  speed,
  frequency,
  amplitude,
  cycleSpeed,
  cycleEase,
  paletteA,
  paletteB,
}: MeshGradientShaderProps) {
  const ctx = useShaderContext();
  const resize = useResize();

  const cycleSpeedU = useAnimatableUniform<number>(cycleSpeed);
  const cycleEaseU = useAnimatableUniform<number>(cycleEase);

  const a0 = useColorUniform(paletteA[0]);
  const a1 = useColorUniform(paletteA[1]);
  const a2 = useColorUniform(paletteA[2]);
  const a3 = useColorUniform(paletteA[3]);
  const b0 = useColorUniform(paletteB[0]);
  const b1 = useColorUniform(paletteB[1]);
  const b2 = useColorUniform(paletteB[2]);
  const b3 = useColorUniform(paletteB[3]);

  const speedU = useAnimatableUniform<number>(speed);
  const frequencyU = useAnimatableUniform<number>(frequency);
  const amplitudeU = useAnimatableUniform<number>(amplitude);

  const resVec = useMemo(() => new Vector2(1920, 1080), []);
  const resNode = useMemo(() => uniform(resVec), [resVec]);

  useEffect(() => {
    const [w, h] = resize.get();

    if (w > 0 && h > 0) resVec.set(w, h);

    return resize.on('change', ([w2, h2]) => resVec.set(w2, h2));
  }, [resize, resVec]);

  useEffect(() => {
    if (!ctx) return;

    // ---- Centered UVs --------------------------------------------------
    const tuvRaw = uv().sub(vec2(0.5, 0.5));

    // ---- Noise-driven rotation angle ----------------------------------
    const tSlow = time.mul(0.05);
    const noiseInput = vec2(tSlow, tuvRaw.x.mul(tuvRaw.y));
    const degree01 = noise(noiseInput).mul(0.5).add(0.5); // [0, 1]
    // angle = (degree01 - 0.5) * (720° in radians) + 180° in radians
    //       = (degree01 - 0.5) * 4π + π
    const TWO_TURNS_RAD = Math.PI * 4;
    const ROT_BIAS_RAD = Math.PI;
    const angle = degree01.sub(0.5).mul(TWO_TURNS_RAD).add(ROT_BIAS_RAD);

    // ---- Aspect-corrected rotation -----------------------------------
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
    const tspeed = time.mul(speedU);
    const warpX = sin(tuvRotated.y.mul(frequencyU).add(tspeed)).div(amplitudeU);
    const warpY = sin(tuvRotated.x.mul(frequencyU).mul(1.5).add(tspeed)).div(amplitudeU).mul(2);
    const tuv = vec2(tuvRotated.x.add(warpX), tuvRotated.y.add(warpY));

    // ---- Time-cycling palette ----------------------------------------
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

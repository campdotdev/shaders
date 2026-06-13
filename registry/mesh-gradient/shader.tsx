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
import { Mesh, MeshBasicNodeMaterial, PlaneGeometry, Vector3 } from 'three/webgpu';

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
      const [redChannel, greenChannel, blueChannel] = parseHex(hex);

      return new Vector3(redChannel, greenChannel, blueChannel);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const node = useMemo(() => uniform(vec), [vec]);

  useEffect(() => {
    const [redChannel, greenChannel, blueChannel] = parseHex(hex);

    vec.set(redChannel, greenChannel, blueChannel);
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
  const shaderContext = useShaderContext();
  const resize = useResize();

  const cycleSpeedUniform = useAnimatableUniform<number>(cycleSpeed);
  const cycleEaseUniform = useAnimatableUniform<number>(cycleEase);

  const paletteAColor0 = useColorUniform(paletteA[0]);
  const paletteAColor1 = useColorUniform(paletteA[1]);
  const paletteAColor2 = useColorUniform(paletteA[2]);
  const paletteAColor3 = useColorUniform(paletteA[3]);
  const paletteBColor0 = useColorUniform(paletteB[0]);
  const paletteBColor1 = useColorUniform(paletteB[1]);
  const paletteBColor2 = useColorUniform(paletteB[2]);
  const paletteBColor3 = useColorUniform(paletteB[3]);

  const speedUniform = useAnimatableUniform<number>(speed);
  const frequencyUniform = useAnimatableUniform<number>(frequency);
  const amplitudeUniform = useAnimatableUniform<number>(amplitude);

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
      if (updatedWidth > 0 && updatedHeight > 0) aspectNode.value = updatedWidth / updatedHeight;
    });
  }, [resize, aspectNode]);

  useEffect(() => {
    if (!shaderContext) return;

    // ---- Centered UVs --------------------------------------------------
    const centeredUv = uv().sub(vec2(0.5, 0.5));

    // ---- Noise-driven rotation angle ----------------------------------
    const slowTime = time.mul(0.05);
    const noiseInput = vec2(slowTime, centeredUv.x.mul(centeredUv.y));
    const degree01 = noise(noiseInput).mul(0.5).add(0.5); // [0, 1]
    // angle = (degree01 - 0.5) * (720° in radians) + 180° in radians
    //       = (degree01 - 0.5) * 4π + π
    const TWO_TURNS_RAD = Math.PI * 4;
    const ROT_BIAS_RAD = Math.PI;
    const angle = degree01.sub(0.5).mul(TWO_TURNS_RAD).add(ROT_BIAS_RAD);

    // ---- Aspect-corrected rotation -----------------------------------
    const aspect = aspectNode;
    const aspectCorrectedY = centeredUv.y.div(aspect);
    const cosineValue = cos(angle);
    const sineValue = sin(angle);
    // Componentwise rotation: (x', y') = (c*x - s*y, s*x + c*y).
    const rotatedX = centeredUv.x.mul(cosineValue).sub(aspectCorrectedY.mul(sineValue));
    const rotatedYUnit = centeredUv.x.mul(sineValue).add(aspectCorrectedY.mul(cosineValue));
    const rotatedY = rotatedYUnit.mul(aspect);
    const rotatedUv = vec2(rotatedX, rotatedY);

    // ---- Sine domain warp --------------------------------------------
    const timeScaledBySpeed = time.mul(speedUniform);
    const warpX = sin(rotatedUv.y.mul(frequencyUniform).add(timeScaledBySpeed)).div(
      amplitudeUniform,
    );
    const warpY = sin(rotatedUv.x.mul(frequencyUniform).mul(1.5).add(timeScaledBySpeed))
      .div(amplitudeUniform)
      .mul(2);
    const warpedUv = vec2(rotatedUv.x.add(warpX), rotatedUv.y.add(warpY));

    // ---- Time-cycling palette ----------------------------------------
    const cycleTime = time.mul(cycleSpeedUniform);
    const cycle = sin(cycleTime);
    const eased = sign(cycle)
      .mul(pow(abs(cycle), cycleEaseUniform))
      .add(1)
      .mul(0.5);

    const color0 = mix(paletteAColor0, paletteBColor0, eased);
    const color1 = mix(paletteAColor1, paletteBColor1, eased);
    const color2 = mix(paletteAColor2, paletteBColor2, eased);
    const color3 = mix(paletteAColor3, paletteBColor3, eased);

    // ---- Two-layer smoothstep blend ---------------------------------
    const layerCosine = Math.cos(LAYER_ROT_RAD);
    const layerSine = Math.sin(LAYER_ROT_RAD);
    const layerX = warpedUv.x.mul(layerCosine).sub(warpedUv.y.mul(layerSine));

    const horizontalMix = smoothstep(-0.3, 0.2, layerX);
    const layer1 = color2.mul(horizontalMix.oneMinus()).add(color1.mul(horizontalMix));
    const layer2 = color3.mul(horizontalMix.oneMinus()).add(color0.mul(horizontalMix));

    const verticalMix = smoothstep(0.5, -0.3, warpedUv.y);
    const color = layer1.mul(verticalMix.oneMinus()).add(layer2.mul(verticalMix));

    const material = new MeshBasicNodeMaterial();

    material.colorNode = vec4(color, 1);

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
  }, [
    shaderContext,
    aspectNode,
    speedUniform,
    frequencyUniform,
    amplitudeUniform,
    cycleSpeedUniform,
    cycleEaseUniform,
    paletteAColor0,
    paletteAColor1,
    paletteAColor2,
    paletteAColor3,
    paletteBColor0,
    paletteBColor1,
    paletteBColor2,
    paletteBColor3,
  ]);

  return null;
}

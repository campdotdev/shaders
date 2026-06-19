'use client';

import { useEffect, useMemo } from 'react';

import { elapsedTime, simplexNoise } from '@lovo/matter';
import {
  type AnimatableProp,
  useAnimatableUniform,
  useResize,
  useShaderContext,
} from '@lovo/matter-react';
import { smoothstep, sub, uniform, uv, vec2, vec3, vec4 } from 'three/tsl';
import { Mesh, MeshBasicNodeMaterial, PlaneGeometry, Vector3 } from 'three/webgpu';

import { parseColor } from '../utils/color';

export interface AuroraLayer {
  color: string;
  speed?: number;
  intensity?: number;
  seed?: number;
  falloff?: number;
}

export interface AuroraBackground {
  horizon: string;
  sky: string;
}

export type AuroraDirection = 'bottom' | 'top' | 'left' | 'right';

const DIRECTION_VECTORS: Record<AuroraDirection, [number, number, number]> = {
  bottom: [0, 1, 0],
  top: [0, -1, 1],
  left: [1, 0, 0],
  right: [-1, 0, 1],
};

const DEFAULT_LAYER_SPEED = 0.1;
const DEFAULT_LAYER_INTENSITY = 0.3;
const DEFAULT_LAYER_FALLOFF = 1;

export interface AuroraShaderProps {
  intensity: AnimatableProp<number>;
  speed: AnimatableProp<number>;
  densityX: AnimatableProp<number>;
  densityY: AnimatableProp<number>;
  falloff: AnimatableProp<number>;
  driftX: AnimatableProp<number>;
  driftY: AnimatableProp<number>;
  turbulence: AnimatableProp<number>;
  direction: AuroraDirection;
  background: AuroraBackground;
  layers: AuroraLayer[];
}

function useColorUniform(hex: string) {
  const vec = useMemo(
    () => {
      const [redChannel, greenChannel, blueChannel] = parseColor(hex);

      return new Vector3(redChannel, greenChannel, blueChannel);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const node = useMemo(() => uniform(vec), [vec]);

  useEffect(() => {
    const [redChannel, greenChannel, blueChannel] = parseColor(hex);

    vec.set(redChannel, greenChannel, blueChannel);
  }, [hex, vec]);

  return node;
}

export function AuroraShader(props: AuroraShaderProps) {
  const shaderContext = useShaderContext();
  const resize = useResize();

  const intensityUniform = useAnimatableUniform<number>(props.intensity);
  const speedUniform = useAnimatableUniform<number>(props.speed);
  const densityXUniform = useAnimatableUniform<number>(props.densityX);
  const densityYUniform = useAnimatableUniform<number>(props.densityY);
  const falloffUniform = useAnimatableUniform<number>(props.falloff);
  const driftXUniform = useAnimatableUniform<number>(props.driftX);
  const driftYUniform = useAnimatableUniform<number>(props.driftY);
  const turbulenceUniform = useAnimatableUniform<number>(props.turbulence);

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

  const dirVec = useMemo(
    () => {
      const [directionX, directionY, directionBias] = DIRECTION_VECTORS[props.direction];

      return new Vector3(directionX, directionY, directionBias);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const dirNode = useMemo(() => uniform(dirVec), [dirVec]);

  useEffect(() => {
    const [directionX, directionY, directionBias] = DIRECTION_VECTORS[props.direction];

    dirVec.set(directionX, directionY, directionBias);
  }, [props.direction, dirVec]);

  const horizonNode = useColorUniform(props.background.horizon);
  const skyNode = useColorUniform(props.background.sky);

  const layersKey = props.layers
    .map(
      (layer) =>
        `${layer.color}|${layer.speed ?? ''}|${layer.intensity ?? ''}|${layer.seed ?? ''}|${layer.falloff ?? ''}`,
    )
    .join('||');

  useEffect(() => {
    const material = new MeshBasicNodeMaterial();

    const aspect = aspectNode;
    const scaledUv = vec2(uv().x.mul(aspect).mul(densityXUniform), uv().y.mul(densityYUniform));

    const fallOff = uv().x.mul(dirNode.x).add(uv().y.mul(dirNode.y)).add(dirNode.z);

    let aurora = vec3(0, 0, 0);

    for (const layer of props.layers) {
      const [redChannel, greenChannel, blueChannel] = parseColor(layer.color);
      const layerColor = vec3(redChannel, greenChannel, blueChannel);
      const layerSpeed = layer.speed ?? DEFAULT_LAYER_SPEED;
      const layerIntensity = layer.intensity ?? DEFAULT_LAYER_INTENSITY;
      const layerFalloff = layer.falloff ?? DEFAULT_LAYER_FALLOFF;
      const seed = layer.seed ?? 0;

      const scaledTime = elapsedTime.mul(speedUniform).mul(layerSpeed);

      const driftPosition = vec2(
        scaledUv.x.add(scaledTime.mul(driftXUniform)),
        scaledUv.y.add(scaledTime.mul(driftYUniform)),
      );

      const warpSeed = vec2(layerColor.x.add(seed), layerColor.y.add(seed + 1));

      const warpOffset = simplexNoise(
        vec2(
          warpSeed.x.add(driftPosition.x).add(scaledTime),
          warpSeed.y.add(driftPosition.y).add(scaledTime),
        ),
      )
        .mul(0.5)
        .add(0.5)
        .mul(turbulenceUniform);

      const noiseValue = simplexNoise(
        vec2(driftPosition.x.add(warpOffset), driftPosition.y.add(warpOffset)),
      )
        .mul(0.5)
        .add(0.5);

      const auroraField = noiseValue.sub(fallOff.mul(falloffUniform).mul(layerFalloff));

      aurora = aurora.add(layerColor.mul(auroraField).mul(layerIntensity).mul(2));
    }

    const sky = horizonNode
      .mul(sub(1, smoothstep(0, 0.5, fallOff)))
      .add(skyNode.mul(sub(1, smoothstep(0.4, 1, fallOff))));

    const finalColor = sky.add(aurora.mul(intensityUniform));

    material.colorNode = vec4(finalColor, 1);

    const mesh = new Mesh(new PlaneGeometry(2, 2), material);

    shaderContext?.scene.add(mesh);

    return () => {
      shaderContext?.scene.remove(mesh);
      try {
        material.dispose();
      } catch {
        // three/webgpu can throw during dispose under Strict Mode double-invoke
      }
    };
    // layersKey is a stable string proxy for props.layers — listing the array
    // itself would rebuild on identity-only changes. Per-layer values are baked
    // as literals, so a content change must trigger a rebuild.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    shaderContext,
    layersKey,
    intensityUniform,
    speedUniform,
    densityXUniform,
    densityYUniform,
    falloffUniform,
    driftXUniform,
    driftYUniform,
    turbulenceUniform,
    horizonNode,
    skyNode,
    aspectNode,
    dirNode,
  ]);

  return null;
}

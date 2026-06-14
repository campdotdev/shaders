'use client';

import { useEffect, useMemo } from 'react';

import { elapsedTime, simplexNoise } from '@lovo/matter';
import {
  type AnimatableProp,
  useAnimatableUniform,
  useResize,
  useShaderContext,
} from '@lovo/matter-react';
import { type ShaderNodeObject, smoothstep, sub, uniform, uv, vec2, vec3, vec4 } from 'three/tsl';
import { Mesh, MeshBasicNodeMaterial, type Node, PlaneGeometry, Vector3 } from 'three/webgpu';

import { parseHex } from '../utils/color';

export interface AuroraLayer {
  color: string;
  speed: AnimatableProp<number>;
  intensity: AnimatableProp<number>;
  seed: number;
  falloff?: AnimatableProp<number>;
}

export type AuroraDirection = 'bottom' | 'top' | 'left' | 'right';

const DIRECTION_VECTORS: Record<AuroraDirection, [number, number, number]> = {
  bottom: [0, 1, 0],
  top: [0, -1, 1],
  left: [1, 0, 0],
  right: [-1, 0, 1],
};

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
  horizonColor: string;
  skyColor: string;
  layers: [AuroraLayer, AuroraLayer, AuroraLayer, AuroraLayer];
}

interface LayerUniforms {
  color: ShaderNodeObject<Node>;
  speed: ShaderNodeObject<Node>;
  intensity: ShaderNodeObject<Node>;
  falloff: ShaderNodeObject<Node>;
}

function useLayerUniforms(layer: AuroraLayer): LayerUniforms {
  const speedUniform = useAnimatableUniform<number>(layer.speed);
  const intensityUniform = useAnimatableUniform<number>(layer.intensity);
  const falloffUniform = useAnimatableUniform<number>(layer.falloff ?? 1);

  const colorVec = useMemo(
    () => {
      const [redChannel, greenChannel, blueChannel] = parseHex(layer.color);

      return new Vector3(redChannel, greenChannel, blueChannel);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const colorNode = useMemo(() => uniform(colorVec), [colorVec]);

  useEffect(() => {
    const [redChannel, greenChannel, blueChannel] = parseHex(layer.color);

    colorVec.set(redChannel, greenChannel, blueChannel);
  }, [layer.color, colorVec]);

  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
  const widenedColor = colorNode as unknown as ShaderNodeObject<Node>;

  return useMemo(
    () => ({
      color: widenedColor,
      speed: speedUniform,
      intensity: intensityUniform,
      falloff: falloffUniform,
    }),
    [widenedColor, speedUniform, intensityUniform, falloffUniform],
  );
}

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

  const horizonNode = useColorUniform(props.horizonColor);
  const skyNode = useColorUniform(props.skyColor);

  const layer0 = useLayerUniforms(props.layers[0]);
  const layer1 = useLayerUniforms(props.layers[1]);
  const layer2 = useLayerUniforms(props.layers[2]);
  const layer3 = useLayerUniforms(props.layers[3]);

  const layerUniforms = useMemo(
    () => [layer0, layer1, layer2, layer3] as const,
    [layer0, layer1, layer2, layer3],
  );

  const seeds = useMemo(
    () =>
      [
        props.layers[0].seed,
        props.layers[1].seed,
        props.layers[2].seed,
        props.layers[3].seed,
      ] as const,
    [props.layers],
  );

  useEffect(() => {
    const material = new MeshBasicNodeMaterial();

    const aspect = aspectNode;
    const scaledUv = vec2(uv().x.mul(aspect).mul(densityXUniform), uv().y.mul(densityYUniform));

    const fallOff = uv().x.mul(dirNode.x).add(uv().y.mul(dirNode.y)).add(dirNode.z);

    let aurora = vec3(0, 0, 0);

    for (let layerIndex = 0; layerIndex < 4; layerIndex += 1) {
      const layerUniform = layerUniforms[layerIndex];
      const seed = seeds[layerIndex];

      if (layerUniform === undefined || seed === undefined) continue;

      const scaledTime = elapsedTime.mul(speedUniform).mul(layerUniform.speed);

      const driftPosition = vec2(
        scaledUv.x.add(scaledTime.mul(driftXUniform)),
        scaledUv.y.add(scaledTime.mul(driftYUniform)),
      );

      const warpSeed = vec2(layerUniform.color.x.add(seed), layerUniform.color.y.add(seed + 1));

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

      const auroraField = noiseValue.sub(fallOff.mul(falloffUniform).mul(layerUniform.falloff));

      aurora = aurora.add(layerUniform.color.mul(auroraField).mul(layerUniform.intensity).mul(2));
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
  }, [
    shaderContext,
    layerUniforms,
    seeds,
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

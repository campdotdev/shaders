'use client';

import { useEffect, useMemo } from 'react';

import { noise, time } from '@lovo/matter';
import {
  type AnimatableProp,
  useAnimatableUniform,
  useResize,
  useShaderContext,
} from '@lovo/matter-react';
import { type ShaderNodeObject, smoothstep, sub, uniform, uv, vec2, vec3, vec4 } from 'three/tsl';
import {
  Mesh,
  MeshBasicNodeMaterial,
  type Node,
  PlaneGeometry,
  Vector3,
} from 'three/webgpu';

import { parseHex } from '../utils/color';

export interface AuroraLayer {
  hex: string;
  speed: AnimatableProp<number>;
  intensity: AnimatableProp<number>;
  variation: number;
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
  const speedU = useAnimatableUniform<number>(layer.speed);
  const intensityU = useAnimatableUniform<number>(layer.intensity);
  const falloffU = useAnimatableUniform<number>(layer.falloff ?? 1);

  const colorVec = useMemo(
    () => {
      const [r, g, b] = parseHex(layer.hex);

      return new Vector3(r, g, b);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const colorNode = useMemo(() => uniform(colorVec), [colorVec]);

  useEffect(() => {
    const [r, g, b] = parseHex(layer.hex);

    colorVec.set(r, g, b);
  }, [layer.hex, colorVec]);

  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
  const widenedColor = colorNode as unknown as ShaderNodeObject<Node>;

  return useMemo(
    () => ({
      color: widenedColor,
      speed: speedU,
      intensity: intensityU,
      falloff: falloffU,
    }),
    [widenedColor, speedU, intensityU, falloffU],
  );
}

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

export function AuroraShader(props: AuroraShaderProps) {
  const ctx = useShaderContext();
  const resize = useResize();

  const intensityU = useAnimatableUniform<number>(props.intensity);
  const speedU = useAnimatableUniform<number>(props.speed);
  const densityXU = useAnimatableUniform<number>(props.densityX);
  const densityYU = useAnimatableUniform<number>(props.densityY);
  const falloffU = useAnimatableUniform<number>(props.falloff);
  const driftXU = useAnimatableUniform<number>(props.driftX);
  const driftYU = useAnimatableUniform<number>(props.driftY);
  const turbulenceU = useAnimatableUniform<number>(props.turbulence);

  const [iw, ih] = resize.get();
  const aspectNode = useMemo(() => uniform(ih > 0 ? iw / ih : 16 / 9), []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const [w, h] = resize.get();

    if (w > 0 && h > 0) aspectNode.value = w / h;

    return resize.on('change', ([w2, h2]) => {
      if (w2 > 0 && h2 > 0) aspectNode.value = w2 / h2;
    });
  }, [resize, aspectNode]);

  const dirVec = useMemo(
    () => {
      const [x, y, b] = DIRECTION_VECTORS[props.direction];

      return new Vector3(x, y, b);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const dirNode = useMemo(() => uniform(dirVec), [dirVec]);

  useEffect(() => {
    const [x, y, b] = DIRECTION_VECTORS[props.direction];

    dirVec.set(x, y, b);
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

  const variations = useMemo(
    () =>
      [
        props.layers[0].variation,
        props.layers[1].variation,
        props.layers[2].variation,
        props.layers[3].variation,
      ] as const,
    [props.layers],
  );

  useEffect(() => {
    const material = new MeshBasicNodeMaterial();

    const aspect = aspectNode;
    const scaledUv = vec2(uv().x.mul(aspect).mul(densityXU), uv().y.mul(densityYU));

    const fallOff = uv().x.mul(dirNode.x).add(uv().y.mul(dirNode.y)).add(dirNode.z);

    let aurora = vec3(0, 0, 0);

    for (let i = 0; i < 4; i += 1) {
      const lu = layerUniforms[i];
      const variation = variations[i];

      if (lu === undefined || variation === undefined) continue;

      const t = time.mul(speedU).mul(lu.speed);

      const p = vec2(scaledUv.x.add(t.mul(driftXU)), scaledUv.y.add(t.mul(driftYU)));

      const warpSeed = vec2(lu.color.x.add(variation), lu.color.y.add(variation + 1));

      const inner = noise(vec2(warpSeed.x.add(p.x).add(t), warpSeed.y.add(p.y).add(t)))
        .mul(0.5)
        .add(0.5)
        .mul(turbulenceU);

      const n = noise(vec2(p.x.add(inner), p.y.add(inner)))
        .mul(0.5)
        .add(0.5);

      const auroraField = n.sub(fallOff.mul(falloffU).mul(lu.falloff));

      aurora = aurora.add(lu.color.mul(auroraField).mul(lu.intensity).mul(2));
    }

    const sky = horizonNode
      .mul(sub(1, smoothstep(0, 0.5, fallOff)))
      .add(skyNode.mul(sub(1, smoothstep(0.4, 1, fallOff))));

    const finalColor = sky.add(aurora.mul(intensityU));

    material.colorNode = vec4(finalColor, 1);

    const mesh = new Mesh(new PlaneGeometry(2, 2), material);

    ctx?.scene.add(mesh);

    return () => {
      ctx?.scene.remove(mesh);
      try {
        material.dispose();
      } catch {
        // three/webgpu can throw during dispose under Strict Mode double-invoke
      }
    };
  }, [
    ctx,
    layerUniforms,
    variations,
    intensityU,
    speedU,
    densityXU,
    densityYU,
    falloffU,
    driftXU,
    driftYU,
    turbulenceU,
    horizonNode,
    skyNode,
    aspectNode,
    dirNode,
  ]);

  return null;
}

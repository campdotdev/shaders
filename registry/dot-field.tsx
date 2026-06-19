'use client';

import { useEffect, useMemo } from 'react';

import { displace, signedDistanceFieldCircle, type TSLNode } from '@lovo/matter';
import {
  type AnimatableProp,
  type CursorSignal,
  useAnimatableUniform,
  useCursor,
  useResize,
  useShaderContext,
} from '@lovo/matter-react';
import {
  length,
  mix,
  mod,
  smoothstep,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import { Mesh, MeshBasicNodeMaterial, PlaneGeometry, Vector2 } from 'three/webgpu';

export interface DotFieldProps {
  spacing?: AnimatableProp<number>;
  dotSize?: AnimatableProp<number>;
  color?: string;
  reach?: AnimatableProp<number>;
  strength?: AnimatableProp<number>;
  interactive?: boolean;
  inputs?: { cursor?: CursorSignal };
}

const DEFAULTS = {
  spacing: 30,
  dotSize: 2,
  color: '#8B918C',
  reach: 100,
  strength: 1,
};

const hexToVec3 = (hex: string): readonly [number, number, number] => {
  const cleanedHex = hex.replace('#', '');
  const redChannel = parseInt(cleanedHex.slice(0, 2), 16) / 255;
  const greenChannel = parseInt(cleanedHex.slice(2, 4), 16) / 255;
  const blueChannel = parseInt(cleanedHex.slice(4, 6), 16) / 255;

  return [redChannel, greenChannel, blueChannel];
};

function buildDotFieldMaterial(
  spacingUniform: TSLNode,
  dotSizeUniform: TSLNode,
  reachUniform: TSLNode,
  strengthUniform: TSLNode,
  cursorUniform: TSLNode,
  resUniform: TSLNode,
  color: readonly [number, number, number],
): MeshBasicNodeMaterial {
  const [redChannel, greenChannel, blueChannel] = color;

  const pxUv = uv().mul(resUniform).div(spacingUniform);
  const cellLocal = mod(pxUv, 1).sub(vec2(0.5, 0.5));

  const cellIndex = pxUv.sub(mod(pxUv, 1));
  const cellCenterUv = cellIndex.add(vec2(0.5, 0.5)).mul(spacingUniform).div(resUniform);

  const cellToCursorPx = cellCenterUv.sub(cursorUniform).mul(-1).mul(resUniform);
  const distToCursorPx = length(cellToCursorPx);
  const influence = smoothstep(reachUniform, 0, distToCursorPx);

  // +0.001 avoids div-by-zero when cursor is exactly over a cell center
  const dirToCursor = cellToCursorPx.div(distToCursorPx.add(0.001));
  const offset = dirToCursor.mul(influence).mul(strengthUniform).mul(0.4);
  const displacedLocal = displace(cellLocal, offset.mul(-1));

  const zeroScalar = vec2(0).x;
  const radius = zeroScalar.add(dotSizeUniform).div(zeroScalar.add(spacingUniform).mul(2));
  const sdf = signedDistanceFieldCircle(displacedLocal, radius);

  const antialiasWidth = 0.01;
  const dotMask = smoothstep(antialiasWidth, -antialiasWidth, sdf);
  const dotColor = mix(vec3(0, 0, 0), vec3(redChannel, greenChannel, blueChannel), dotMask);

  const material = new MeshBasicNodeMaterial();

  material.colorNode = vec4(dotColor, dotMask);

  return material;
}

export function DotField(props: DotFieldProps) {
  const shaderContext = useShaderContext();
  const cursorFromInputs = props.inputs?.cursor;
  const cursorAuto = useCursor();
  const cursor = cursorFromInputs ?? ((props.interactive ?? true) ? cursorAuto : null);
  const resize = useResize();

  const spacingUniform = useAnimatableUniform<number>(props.spacing ?? DEFAULTS.spacing);
  const dotSizeUniform = useAnimatableUniform<number>(props.dotSize ?? DEFAULTS.dotSize);
  const reachUniform = useAnimatableUniform<number>(props.reach ?? DEFAULTS.reach);
  const strengthUniform = useAnimatableUniform<number>(props.strength ?? DEFAULTS.strength);

  const color = useMemo(() => hexToVec3(props.color ?? DEFAULTS.color), [props.color]);

  const cursorVec = useMemo(() => new Vector2(0.5, 0.5), []);
  const cursorUniform = useMemo(() => uniform(cursorVec), [cursorVec]);

  useEffect(() => {
    if (cursor)
      return cursor.on('change', ([cursorX, cursorY]) => cursorVec.set(cursorX, 1 - cursorY));
    cursorVec.set(0.5, 0.5);

    return undefined;
  }, [cursor, cursorVec]);

  const resVec = useMemo(() => new Vector2(1920, 1080), []);
  const resUniform = useMemo(() => uniform(resVec), [resVec]);

  useEffect(() => {
    const [canvasWidth, canvasHeight] = resize.get();

    if (canvasWidth > 0 && canvasHeight > 0) resVec.set(canvasWidth, canvasHeight);

    return resize.on('change', ([updatedWidth, updatedHeight]) =>
      resVec.set(updatedWidth, updatedHeight),
    );
  }, [resize, resVec]);

  useEffect(() => {
    if (!shaderContext) return;

    const material = buildDotFieldMaterial(
      spacingUniform,
      dotSizeUniform,
      reachUniform,
      strengthUniform,
      cursorUniform,
      resUniform,
      color,
    );
    const mesh = new Mesh(new PlaneGeometry(2, 2), material);

    shaderContext.scene.add(mesh);

    return () => {
      shaderContext.scene.remove(mesh);
      try {
        material.dispose();
      } catch {
        /* benign during rebuild */
      }
      try {
        mesh.geometry.dispose();
      } catch {
        /* same */
      }
    };
  }, [
    shaderContext,
    color,
    spacingUniform,
    dotSizeUniform,
    reachUniform,
    strengthUniform,
    cursorUniform,
    resUniform,
  ]);

  return null;
}

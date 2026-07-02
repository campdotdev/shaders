'use client';

import { useEffect, useMemo } from 'react';

import { signedDistanceFieldCircle, type TSLNode } from '@lovo/matter';
import {
  type AnimatableProp,
  useAnimatableUniform,
  useResize,
  useShaderContext,
} from '@lovo/matter-react';
import { mix, round, smoothstep, uniform, uv, vec2, vec3, vec4 } from 'three/tsl';
import { Mesh, MeshBasicNodeMaterial, PlaneGeometry, Vector2 } from 'three/webgpu';

import { parseColor } from '../utils/color';

export interface DotFieldShaderProps {
  spacing: AnimatableProp<number>;
  dotSize: AnimatableProp<number>;
  color: string;
}

function buildDotFieldMaterial(
  spacingUniform: TSLNode,
  dotSizeUniform: TSLNode,
  resUniform: TSLNode,
  color: readonly [number, number, number],
): MeshBasicNodeMaterial {
  const [redChannel, greenChannel, blueChannel] = color;

  // Cell-space coordinate measured outward from the canvas center (0 at center).
  const cellCoord = uv().sub(0.5).mul(resUniform).div(spacingUniform);
  // Signed offset to the nearest dot center: 0 at a dot, ±0.5 at a cell edge.
  // Anchoring at center makes opposite-edge margins symmetric and puts a dot
  // exactly at the middle (where the Phase 3 ripple will emanate from).
  const cellLocal = cellCoord.sub(round(cellCoord));

  const zeroScalar = vec2(0).x;
  const radius = zeroScalar.add(dotSizeUniform).div(zeroScalar.add(spacingUniform).mul(2));
  const sdf = signedDistanceFieldCircle(cellLocal, radius);

  const antialiasWidth = 0.01;
  const dotMask = smoothstep(antialiasWidth, -antialiasWidth, sdf);
  const dotColor = mix(vec3(0, 0, 0), vec3(redChannel, greenChannel, blueChannel), dotMask);

  const material = new MeshBasicNodeMaterial();

  material.colorNode = vec4(dotColor, dotMask);

  return material;
}

export function DotFieldShader({ spacing, dotSize, color }: DotFieldShaderProps) {
  const shaderContext = useShaderContext();
  const resize = useResize();

  const spacingUniform = useAnimatableUniform<number>(spacing);
  const dotSizeUniform = useAnimatableUniform<number>(dotSize);

  const parsedColor = useMemo(() => parseColor(color), [color]);

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

    const material = buildDotFieldMaterial(spacingUniform, dotSizeUniform, resUniform, parsedColor);
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
  }, [shaderContext, parsedColor, spacingUniform, dotSizeUniform, resUniform]);

  return null;
}

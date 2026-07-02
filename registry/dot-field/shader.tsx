'use client';

import { useEffect, useMemo } from 'react';

import { displace, elapsedTime, signedDistanceFieldCircle, type TSLNode } from '@lovo/matter';
import {
  type AnimatableProp,
  useAnimatableUniform,
  useResize,
  useShaderContext,
} from '@lovo/matter-react';
import { exp, length, mix, round, sin, smoothstep, uniform, uv, vec2, vec3, vec4 } from 'three/tsl';
import { Mesh, MeshBasicNodeMaterial, PlaneGeometry, Vector2 } from 'three/webgpu';

import { parseColor } from '../utils/color';

export interface DotFieldShaderProps {
  spacing: AnimatableProp<number>;
  dotSize: AnimatableProp<number>;
  color: string;
  speed: AnimatableProp<number>;
  amplitude: AnimatableProp<number>;
  wavelength: AnimatableProp<number>;
  decay: AnimatableProp<number>;
  center: [number, number];
}

function buildDotFieldMaterial(
  spacingUniform: TSLNode,
  dotSizeUniform: TSLNode,
  speedUniform: TSLNode,
  amplitudeUniform: TSLNode,
  wavelengthUniform: TSLNode,
  decayUniform: TSLNode,
  centerUniform: TSLNode,
  resUniform: TSLNode,
  color: readonly [number, number, number],
): MeshBasicNodeMaterial {
  const [redChannel, greenChannel, blueChannel] = color;

  const cellCoord = uv().sub(0.5).mul(resUniform).div(spacingUniform);
  const cellIndex = round(cellCoord);
  const cellLocal = cellCoord.sub(cellIndex);

  // Ripple origin snapped to the nearest dot, in the same integer lattice space
  // as the cells. vec2(0).add(centerUniform) lifts the bare uniform into a node
  // receiver so the chain stays Gotcha #12-safe (uniforms only ever arguments).
  const originIndex = round(
    vec2(0, 0).add(centerUniform).sub(0.5).mul(resUniform).div(spacingUniform),
  );

  // Vector from the origin dot to this dot, in cell units (isotropic, square cells).
  const toCell = cellIndex.sub(originIndex);
  const distCells = length(toCell);
  // +0.001 avoids div-by-zero for the dot sitting exactly on the ripple origin
  const dirFromCenter = toCell.div(distCells.add(0.001));
  const distToCenterPx = distCells.mul(spacingUniform);

  // Traveling wave: crests move outward as elapsedTime grows.
  const phase = distToCenterPx.div(wavelengthUniform).sub(elapsedTime.mul(speedUniform));
  const wave = sin(phase.mul(Math.PI * 2));

  // Fade the wave with distance so the ripple settles toward the edges.
  const distNorm = distToCenterPx.div(length(resUniform).mul(0.5));
  const falloff = exp(distNorm.mul(decayUniform).mul(-1));

  // Push each dot radially by the (faded) wave, in cell-local units.
  const offset = dirFromCenter.mul(wave).mul(amplitudeUniform).mul(falloff);
  const displacedLocal = displace(cellLocal, offset);

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

export function DotFieldShader({
  spacing,
  dotSize,
  color,
  speed,
  amplitude,
  wavelength,
  decay,
  center,
}: DotFieldShaderProps) {
  const shaderContext = useShaderContext();
  const resize = useResize();

  const spacingUniform = useAnimatableUniform<number>(spacing);
  const dotSizeUniform = useAnimatableUniform<number>(dotSize);
  const speedUniform = useAnimatableUniform<number>(speed);
  const amplitudeUniform = useAnimatableUniform<number>(amplitude);
  const wavelengthUniform = useAnimatableUniform<number>(wavelength);
  const decayUniform = useAnimatableUniform<number>(decay);

  const parsedColor = useMemo(() => parseColor(color), [color]);

  const centerVec = useMemo(() => new Vector2(0.5, 0.5), []);
  const centerUniform = useMemo(() => uniform(centerVec), [centerVec]);

  useEffect(() => {
    centerVec.set(center[0], center[1]);
  }, [centerVec, center]);

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
      speedUniform,
      amplitudeUniform,
      wavelengthUniform,
      decayUniform,
      centerUniform,
      resUniform,
      parsedColor,
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
    parsedColor,
    spacingUniform,
    dotSizeUniform,
    speedUniform,
    amplitudeUniform,
    wavelengthUniform,
    decayUniform,
    centerUniform,
    resUniform,
  ]);

  return null;
}

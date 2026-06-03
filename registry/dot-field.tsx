'use client';

import { displace, sdfCircle } from '@lovo/matter';
import {
  type AnimatableProp,
  type CursorSignal,
  useAnimatableUniform,
  useCursor,
  useResize,
  useShaderContext,
} from '@lovo/matter-react';
import { useEffect, useMemo } from 'react';
import {
  length,
  mix,
  mod,
  type ShaderNodeObject,
  smoothstep,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import {
  Mesh,
  MeshBasicNodeMaterial,
  type Node,
  PlaneGeometry,
  Vector2,
} from 'three/webgpu';

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
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;

  return [r, g, b];
};

function buildDotFieldMaterial(
  spacingU: ShaderNodeObject<Node>,
  dotSizeU: ShaderNodeObject<Node>,
  reachU: ShaderNodeObject<Node>,
  strengthU: ShaderNodeObject<Node>,
  cursorU: ShaderNodeObject<Node>,
  resU: ShaderNodeObject<Node>,
  color: readonly [number, number, number]
): MeshBasicNodeMaterial {
  const [cr, cg, cb] = color;

  const pxUv = uv().mul(resU).div(spacingU);
  const cellLocal = mod(pxUv, 1).sub(vec2(0.5, 0.5));

  const cellIndex = pxUv.sub(mod(pxUv, 1));
  const cellCenterUv = cellIndex.add(vec2(0.5, 0.5)).mul(spacingU).div(resU);

  const cellToCursorPx = cellCenterUv.sub(cursorU).mul(-1).mul(resU);
  const distToCursorPx = length(cellToCursorPx);
  const influence = smoothstep(reachU, 0, distToCursorPx);

  // +0.001 avoids div-by-zero when cursor is exactly over a cell center
  const dirToCursor = cellToCursorPx.div(distToCursorPx.add(0.001));
  const offset = dirToCursor.mul(influence).mul(strengthU).mul(0.4);
  const displacedLocal = displace(cellLocal, offset.mul(-1));

  const zeroScalar = vec2(0).x;
  const radius = zeroScalar.add(dotSizeU).div(zeroScalar.add(spacingU).mul(2));
  const sdf = sdfCircle(displacedLocal, radius);

  const aa = 0.01;
  const dotMask = smoothstep(aa, -aa, sdf);
  const dotColor = mix(vec3(0, 0, 0), vec3(cr, cg, cb), dotMask);

  const material = new MeshBasicNodeMaterial();

  material.colorNode = vec4(dotColor, dotMask);

  return material;
}

export function DotField(props: DotFieldProps) {
  const ctx = useShaderContext();
  const cursorFromInputs = props.inputs?.cursor;
  const cursorAuto = useCursor();
  const cursor =
    cursorFromInputs ?? (props.interactive ?? true ? cursorAuto : null);
  const resize = useResize();

  const spacingUniform = useAnimatableUniform<number>(
    props.spacing ?? DEFAULTS.spacing
  );
  const dotSizeUniform = useAnimatableUniform<number>(
    props.dotSize ?? DEFAULTS.dotSize
  );
  const reachUniform = useAnimatableUniform<number>(
    props.reach ?? DEFAULTS.reach
  );
  const strengthUniform = useAnimatableUniform<number>(
    props.strength ?? DEFAULTS.strength
  );

  const color = useMemo(
    () => hexToVec3(props.color ?? DEFAULTS.color),
    [props.color]
  );

  const cursorVec = useMemo(() => new Vector2(0.5, 0.5), []);
  const cursorUniform = useMemo(() => uniform(cursorVec), [cursorVec]);

  useEffect(() => {
    // y-flip: cursor y is in DOM space (down = +y); shader UV y is up = +y
    if (cursor) return cursor.on('change', ([x, y]) => cursorVec.set(x, 1 - y));
    cursorVec.set(0.5, 0.5);

    return undefined;
  }, [cursor, cursorVec]);

  // Seed with a plausible resolution; ResizeObserver fires on mount to correct it
  const resVec = useMemo(() => new Vector2(1920, 1080), []);
  const resUniform = useMemo(() => uniform(resVec), [resVec]);

  useEffect(() => {
    const [w, h] = resize.get();

    if (w > 0 && h > 0) resVec.set(w, h);

    return resize.on('change', ([w2, h2]) => resVec.set(w2, h2));
  }, [resize, resVec]);

  useEffect(() => {
    if (!ctx) return;

    const material = buildDotFieldMaterial(
      spacingUniform,
      dotSizeUniform,
      reachUniform,
      strengthUniform,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
      cursorUniform as unknown as ShaderNodeObject<Node>,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
      resUniform as unknown as ShaderNodeObject<Node>,
      color
    );
    const mesh = new Mesh(new PlaneGeometry(2, 2), material);

    ctx.scene.add(mesh);

    return () => {
      ctx.scene.remove(mesh);
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
    ctx,
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

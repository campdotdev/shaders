'use client';

import { useEffect, useMemo } from 'react';

import type { ShaderNodeObject } from 'three/tsl';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import type { Node } from 'three/webgpu';

export type ColorTSL = Node | ShaderNodeObject<Node>;

export function useShaderMaterial(build: () => ColorTSL): MeshBasicNodeMaterial {
  const material = useMemo(() => {
    const nodeMaterial = new MeshBasicNodeMaterial();

    nodeMaterial.colorNode = build();

    return nodeMaterial;
  }, [build]);

  useEffect(() => {
    return () => material.dispose();
  }, [material]);

  return material;
}

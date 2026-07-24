'use client';

// Mode 2's entry point: turns a TSL builder callback into a material for the
// user's own react-three-fiber <Canvas>, skipping <ShaderScene> entirely.
import { useEffect, useMemo } from 'react';

import type { ShaderNodeObject } from 'three/tsl';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import type { Node } from 'three/webgpu';

export type ColorTSL = Node | ShaderNodeObject<Node>;

export function useShaderMaterial(build: () => ColorTSL): MeshBasicNodeMaterial {
  // Rebuilds whenever `build`'s reference changes — BY DESIGN, and a test
  // asserts the dep. Callers memoize (or hoist) the callback and route live
  // values through uniforms; an inline arrow here would recompile the
  // material every render. Don't "fix" this by dropping the dep.
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

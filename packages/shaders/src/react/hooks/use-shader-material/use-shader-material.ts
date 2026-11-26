'use client';

// Mode 2's entry point: turns a TSL builder callback into a material for the
// user's own react-three-fiber <Canvas>, skipping <ShaderScene> entirely.
// The callback returns a color, or a color and a vertex position for a mesh
// the shader places itself, such as strands widened with extrudeStrand.
// The material is built in render so the first render can hand it to a mesh,
// and the effect below asks for a new one once a remount has disposed it.
import { useEffect, useMemo, useRef, useState } from 'react';

import type { ShaderNodeObject } from 'three/tsl';
import { AdditiveBlending, MeshBasicNodeMaterial } from 'three/webgpu';
import type { Node } from 'three/webgpu';

import type { TSLNode } from '../../../engine.js';

export type ColorTSL = Node | ShaderNodeObject<Node>;

/** The nodes a build callback returns when the shader also places the mesh's vertices. */
export interface ShaderMaterialNodes {
  /** The color of each pixel the mesh covers. */
  color: ColorTSL;
  /**
   * Where each vertex lands, as a vec4 in clip space. It replaces three's
   * own position setup, so the mesh's `position` attribute and its
   * transform apply only if this node reads them.
   */
  vertex: TSLNode;
}

export interface ShaderMaterialOptions {
  /**
   * How the material's color combines with what is already drawn.
   * `'normal'` covers it. `'additive'` adds to it, so overlapping meshes sum
   * into brighter light. An additive material is transparent and writes no
   * depth, so it never hides anything, and meshes in front still hide it.
   * Defaults to `'normal'`.
   */
  blending?: 'normal' | 'additive';
}

// A TSL node is an object too, so the check asks for the flag three sets on
// every node. The object form has no such field.
const isNode = (built: ColorTSL | ShaderMaterialNodes): built is ColorTSL => 'isNode' in built;

export function useShaderMaterial(
  build: () => ColorTSL | ShaderMaterialNodes,
  options: ShaderMaterialOptions = {},
): MeshBasicNodeMaterial {
  // Read out of the options object, so a new object with the same blending
  // on every render does not rebuild the material.
  const { blending = 'normal' } = options;

  // Counts the materials this call has disposed while still mounted. It is
  // a memo dep, so bumping it builds a fresh material in the next render.
  const [generation, setGeneration] = useState(0);
  // The material the last cleanup disposed, so the next mount can tell a
  // Strict Mode remount of the same material from a first mount.
  const disposedRef = useRef<MeshBasicNodeMaterial | null>(null);

  // Rebuilds whenever `build`'s reference changes — BY DESIGN, and a test
  // asserts the dep. Callers memoize (or hoist) the callback and route live
  // values through uniforms; an inline arrow here would recompile the
  // material every render. Don't "fix" this by dropping the dep.
  const material = useMemo(() => {
    const nodeMaterial = new MeshBasicNodeMaterial();

    const built = build();

    if (isNode(built)) {
      nodeMaterial.colorNode = built;
    } else {
      nodeMaterial.colorNode = built.color;
      // In three 0.170 a set vertexNode replaces three's whole position
      // setup. At a three upgrade, check that it still does (ADR 0008).
      nodeMaterial.vertexNode = built.vertex;
    }

    if (blending === 'additive') {
      nodeMaterial.blending = AdditiveBlending;
      // three draws transparent meshes after the opaque ones, so the light
      // adds on top of a finished scene. Without depth writes, one additive
      // mesh never hides another where they cross. It still tests against
      // depth, so opaque meshes in front hide it.
      nodeMaterial.transparent = true;
      nodeMaterial.depthWrite = false;
    }

    return nodeMaterial;
    // `generation` is a dep on purpose: it forces the rebuild after a remount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [build, blending, generation]);

  // Owns the material's lifetime. The Strict Mode gotcha in
  // `docs/agents/tsl.md` says to create and dispose in one effect, but a
  // Mode 2 user passes the material into JSX on the first render, so the
  // memo above has to build it. Strict Mode and an <Activity> re-show run
  // this cleanup and then mount again with the same memoized material. The
  // cleanup has already disposed it by then, so the second mount asks for a
  // new generation instead of adopting a dead one. A Fast Refresh needs no
  // help: it swaps the component's type, React then ignores the memo's old
  // deps, and the memo builds a fresh material before the effect mounts.
  useEffect(() => {
    if (disposedRef.current === material) {
      disposedRef.current = null;
      setGeneration((count) => count + 1);

      return undefined;
    }

    // A fresh material: nothing to recover, so drop the record of the one
    // the last cleanup disposed and own this one until the next cleanup.
    disposedRef.current = null;

    return () => {
      material.dispose();
      disposedRef.current = material;
    };
  }, [material]);

  return material;
}

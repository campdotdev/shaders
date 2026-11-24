'use client';

// Mode 2's entry point: turns a TSL builder callback into a material for the
// user's own react-three-fiber <Canvas>, skipping <ShaderScene> entirely.
// The material is built in render so the first render can hand it to a mesh,
// and the effect below asks for a new one once a remount has disposed it.
import { useEffect, useMemo, useRef, useState } from 'react';

import type { ShaderNodeObject } from 'three/tsl';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import type { Node } from 'three/webgpu';

export type ColorTSL = Node | ShaderNodeObject<Node>;

export function useShaderMaterial(build: () => ColorTSL): MeshBasicNodeMaterial {
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

    nodeMaterial.colorNode = build();

    return nodeMaterial;
    // `generation` is a dep on purpose: it forces the rebuild after a remount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [build, generation]);

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

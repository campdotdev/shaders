'use client';

// The Output card's face: a real, live ShaderScene rendering whatever the
// graph currently wires into it. The mesh-mounting child follows the probe
// pattern (build material, add plane, clean up), rebuilding only when the
// graph's STRUCTURE changes — drags and selections never recompile.
import { useEffect } from 'react';

import { getReducedMotionTimeScale } from '@mattermix/shaders';
import type { SchedulerTick } from '@mattermix/shaders';
import { ShaderScene, useShaderContext } from '@mattermix/shaders-react';
import { Mesh, MeshBasicNodeMaterial, PlaneGeometry } from 'three/webgpu';

import { compileOutputColor } from '@/editor/graph/compile';
import { useEditorGraph } from '@/editor/state/graph-context';
import VisualTestPause from '@/lib/VisualTestPause';

// Exported for the /parity/runtime dev route, which renders the same mesh
// full-viewport under its own EditorGraphContext — same compile path, no
// editor chrome.
export function CompiledMesh({ nodeId }: { nodeId: string }) {
  const shaderContext = useShaderContext();
  const { nodes, edges, structuralKey, paramStore } = useEditorGraph();

  useEffect(
    () => {
      if (!shaderContext) return;

      const material = new MeshBasicNodeMaterial();

      material.colorNode = compileOutputColor(nodes, edges, nodeId, paramStore);

      const mesh = new Mesh(new PlaneGeometry(2, 2), material);

      shaderContext.scene.add(mesh);
      shaderContext.scheduler.requestRender();

      return () => {
        shaderContext.scene.remove(mesh);
        try {
          material.dispose();
        } catch {
          // three/webgpu can throw during dispose under Strict Mode double-invoke
        }
        try {
          mesh.geometry.dispose();
        } catch {
          // same
        }
      };
    },
    // structuralKey is the stable proxy for nodes/edges: any wiring change
    // produces a new key, while drags (position-only) do not, so the arrays
    // themselves stay out of the deps on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shaderContext, nodeId, structuralKey],
  );

  // The store's animation clock: one scheduler client advances every node's
  // phase each frame (speed x delta, capped, scaled by reduced-motion), and
  // the reset channel rewinds phases so visual tests get reproducible frames.
  useEffect(() => {
    const scheduler = shaderContext?.scheduler;

    if (!scheduler) return undefined;

    const scale = getReducedMotionTimeScale();
    const tick = ({ delta }: SchedulerTick) => paramStore.advancePhases(delta, scale.value);

    scheduler.add(tick);
    const unsubscribeReset = scheduler.onPhaseReset(() => paramStore.resetPhases());

    return () => {
      scheduler.remove(tick);
      unsubscribeReset();
    };
  }, [shaderContext, paramStore]);

  return null;
}

export function OutputPreview({ nodeId }: { nodeId: string }) {
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <ShaderScene>
        <CompiledMesh nodeId={nodeId} />
        {/* Inert without ?visualTest=1: the visual specs freeze the preview
            through it so canvas pixels are reproducible. */}
        <VisualTestPause />
      </ShaderScene>
    </div>
  );
}

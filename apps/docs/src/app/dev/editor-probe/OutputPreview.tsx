'use client';

// The Output card's face: a real, live ShaderScene rendering whatever the
// graph currently wires into it. The mesh-mounting child follows the probe
// pattern (build material, add plane, clean up), rebuilding only when the
// graph's STRUCTURE changes — drags and selections never recompile.
import { useEffect } from 'react';

import { ShaderScene, useShaderContext } from '@lovo/matter-react';
import { Mesh, MeshBasicNodeMaterial, PlaneGeometry } from 'three/webgpu';

import { compileOutputColor } from './compile';
import { useEditorGraph } from './graph-context';

function CompiledMesh({ nodeId }: { nodeId: string }) {
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

  return null;
}

export function OutputPreview({ nodeId }: { nodeId: string }) {
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <ShaderScene>
        <CompiledMesh nodeId={nodeId} />
      </ShaderScene>
    </div>
  );
}

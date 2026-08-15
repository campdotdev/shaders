'use client';

// The runtime half of the eject-parity comparison: the STARTER graph's
// compiled output rendered full-viewport with no editor chrome, through
// exactly the editor's own compile path (CompiledMesh + compileOutputColor).
// Task 17 pixel-compares this against the emitter's generated component;
// until then it doubles as a stable visual-spec target. Dev-route only —
// see page.dev.tsx beside this file.
import { useMemo } from 'react';

import { ShaderScene } from '@lovo/matter-react';

import { structuralKeyOf } from '@/editor/graph';
import type { GraphEdge, GraphNode } from '@/editor/graph';
import { EditorGraphContext } from '@/editor/graph-context';
import type { EditorGraph } from '@/editor/graph-context';
import { CompiledMesh } from '@/editor/OutputPreview';
import { ParamStore } from '@/editor/param-store';
import { defaultParamsOf } from '@/editor/registry';
import { STARTER_EDGES, STARTER_NODES } from '@/editor/starter-graph';
import VisualTestPause from '@/lib/VisualTestPause';

export default function ParityRuntimeScene() {
  // The starter graph in compiler shape, with every card on its defaults —
  // the same values the emitter bakes into the generated component, which is
  // what makes the two halves comparable pixel for pixel.
  const graph = useMemo((): EditorGraph => {
    const nodes: GraphNode[] = STARTER_NODES.map(({ id, spec }) => ({
      id,
      spec,
      params: defaultParamsOf(spec),
    }));
    const edges: GraphEdge[] = STARTER_EDGES.map((edge) => ({ ...edge }));

    return {
      nodes,
      edges,
      structuralKey: structuralKeyOf(nodes, edges),
      paramStore: new ParamStore(),
      // Nothing on this route edits, so there is nothing to record.
      commitEdit: () => undefined,
    };
  }, []);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000' }}>
      <EditorGraphContext.Provider value={graph}>
        <ShaderScene>
          <CompiledMesh nodeId="output-1" />
          <VisualTestPause />
        </ShaderScene>
      </EditorGraphContext.Provider>
    </div>
  );
}

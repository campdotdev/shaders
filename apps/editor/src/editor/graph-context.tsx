'use client';

// Hands the live graph (compiler-shaped nodes/edges, a structural fingerprint,
// and the shared ParamStore) down to card internals. The Output card's preview
// consumes it to compile its own upstream subgraph; the params popover writes
// slider values through the store. The structural key ignores node positions
// and slider values — only wiring, specs, and BAKED (select/ramp) params
// rebuild a material. `structuralKeyOf` itself lives in graph.ts (shared with
// the compiler and code emitter), not here.
import { createContext, useContext } from 'react';

import type { GraphEdge, GraphNode } from './graph';
import type { ParamStore } from './param-store';

export interface EditorGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** Fingerprint of what's COMPILED IN: specs, wiring, select params. */
  structuralKey: string;
  paramStore: ParamStore;
  /**
   * Records one undo step for the edit that just landed. Only the edits that
   * DON'T move the structural key need it — a slider or ramp drag, which
   * rides uniforms and is meant to collapse into a single entry on release.
   * Structural edits record themselves (see use-editor-history.ts).
   */
  commitEdit: () => void;
}

export const EditorGraphContext = createContext<EditorGraph | null>(null);

export function useEditorGraph(): EditorGraph {
  const graph = useContext(EditorGraphContext);

  if (graph === null) {
    throw new Error('useEditorGraph must be used inside the editor canvas');
  }

  return graph;
}

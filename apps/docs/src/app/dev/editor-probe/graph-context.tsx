'use client';

// Hands the live graph (compiler-shaped nodes/edges, a structural fingerprint,
// and the shared ParamStore) down to card internals. The Output card's preview
// consumes it to compile its own upstream subgraph; the params popover writes
// slider values through the store. The structural key ignores node positions
// and slider values — only wiring, specs, and BAKED (select) params rebuild a
// material.
import { createContext, useContext } from 'react';

import type { GraphEdge, GraphNode } from './compile';
import type { ParamStore } from './param-store';
import { NODE_SPECS } from './registry';

export interface EditorGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** Fingerprint of what's COMPILED IN: specs, wiring, select params. */
  structuralKey: string;
  paramStore: ParamStore;
}

export const EditorGraphContext = createContext<EditorGraph | null>(null);

export function useEditorGraph(): EditorGraph {
  const graph = useContext(EditorGraphContext);

  if (graph === null) {
    throw new Error('useEditorGraph must be used inside the editor canvas');
  }

  return graph;
}

/** Builds the fingerprint the material effects key on. */
export function structuralKeyOf(nodes: GraphNode[], edges: GraphEdge[]): string {
  const nodePart = nodes
    .map((node) => {
      // Select params compile to different math, so they belong in the key;
      // slider params ride uniforms and deliberately stay out of it. The
      // registry's declared kind decides which is which — not the value's
      // runtime type, which only coincidentally separates them today. Spec
      // order is fixed, so the entries are deterministic without sorting.
      const baked = NODE_SPECS[node.spec].params
        .filter((param) => param.kind === 'select')
        .map((param) => [param.id, node.params[param.id] ?? param.defaultValue]);

      return `${node.id}:${node.spec}:${JSON.stringify(baked)}`;
    })
    .sort();
  const edgePart = edges
    .map((edge) => `${edge.source}>${edge.target}@${edge.targetHandle ?? ''}`)
    .sort();

  return JSON.stringify([nodePart, edgePart]);
}

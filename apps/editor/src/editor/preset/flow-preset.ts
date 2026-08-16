// Adapters between React Flow's live canvas state and the Preset format --
// the trip undo/redo, file import/export, and URL sharing all take. A Preset
// (preset.ts) is the editor's serialization format; React Flow state carries
// extra runtime fields on top of it (selection, measured size, the params
// panel's `open` flag) that deliberately do NOT survive the round trip.
//
// The node and edge constructors live here too, because rebuilding a canvas
// from a preset needs exactly the same builders a live edit does -- a
// restored card has to be indistinguishable from one the toolbar just added.
//
// Round-trip fidelity is load-bearing: `presetFromFlow(flowFromPreset(p))`
// must serialize byte-identically to `p`, because that identity is what stops
// an undo from recording itself as a fresh history entry (see
// use-editor-history.ts).
import { parseColorString } from '@lovo/matter/color';
import type { Edge } from '@xyflow/react';

import type { CardNodeType } from '@/editor/canvas/CardNode';
import { rampStopsOf } from '@/editor/graph/graph';
import type { ParamStore } from '@/editor/graph/param-store';
import { defaultParamsOf, NODE_SPECS, PORT_COLORS } from '@/editor/graph/registry';
import type { PortType, SpecId } from '@/editor/graph/registry';
import { STARTER_EDGES, STARTER_NODES } from '@/editor/graph/starter-graph';

import { presetFrom } from './preset';
import type { Preset, PresetEdge, PresetNode } from './preset';

// ---------------------------------------------------------------------------
// Constructors — the one place a card node or a typed wire is built, shared by
// the toolbar's live adds, the starter graph, and preset restores.
// ---------------------------------------------------------------------------

/** Builds a canvas card at a position, with its spec's default dial values. */
export function makeNode(id: string, spec: SpecId, x: number, y: number): CardNodeType {
  return {
    id,
    type: 'card',
    position: { x, y },
    data: { spec, params: defaultParamsOf(spec) },
    // The Output card is a singleton the graph always needs a home for — it
    // can't be deleted, so Backspace and the card's own delete control (which
    // never renders for Output in the first place) both respect that for free.
    deletable: spec !== 'output',
  };
}

/**
 * Styles an edge with its port type's tint so wires read as typed at a
 * glance, and tags it with the `typed` edge type so selecting it reveals the
 * delete control. Generic so it takes both full edges (the starter set,
 * preset restores) and id-less connections (live connects — addEdge
 * generates the id).
 */
export function typedEdge<EdgeLike extends Omit<Edge, 'id' | 'style' | 'type'>>(
  edge: EdgeLike,
  portType: PortType,
): EdgeLike & Pick<Edge, 'style' | 'type'> {
  return { ...edge, type: 'typed', style: { stroke: PORT_COLORS[portType], strokeWidth: 1.7 } };
}

/** A wire's tint comes from the source card's output type — the same rule for
    starter wiring, live connects, and restores. Output has no output port of
    its own, so the `field` fallback covers a spec whose `output` is null. */
function tintOf(specId: SpecId | undefined): PortType {
  return specId === undefined ? 'field' : (NODE_SPECS[specId].output ?? 'field');
}

// ---------------------------------------------------------------------------
// Starter graph — the prewired example (starter-graph.ts) hydrated into React
// Flow's shapes once, at module load.
// ---------------------------------------------------------------------------

export const STARTER_FLOW_NODES: CardNodeType[] = STARTER_NODES.map(({ id, spec, x, y }) =>
  makeNode(id, spec, x, y),
);

export const STARTER_FLOW_EDGES: Edge[] = STARTER_EDGES.map((edge, index) => {
  const sourceNode = STARTER_NODES.find((candidate) => candidate.id === edge.source);

  return typedEdge({ id: `starter-${index}`, ...edge }, tintOf(sourceNode?.spec));
});

// ---------------------------------------------------------------------------
// Canvas -> Preset
// ---------------------------------------------------------------------------

/**
 * Snapshots the canvas as a preset. Node and edge order are preserved exactly
 * as React Flow holds them, which (with `serializePreset`'s fixed field
 * order) is what makes two identical canvases serialize to identical strings.
 */
export function presetFromFlow(nodes: CardNodeType[], edges: Edge[]): Preset {
  const presetNodes: PresetNode[] = nodes.map((node) => ({
    id: node.id,
    spec: node.data.spec,
    position: { x: node.position.x, y: node.position.y },
    params: node.data.params,
  }));

  const presetEdges: PresetEdge[] = edges.map((edge) => ({
    source: edge.source,
    target: edge.target,
    targetHandle: edge.targetHandle ?? firstInputIdOf(nodes, edge.target),
  }));

  return presetFrom(presetNodes, presetEdges);
}

/**
 * Fallback for an edge React Flow left without a `targetHandle`. Every input
 * handle CardPorts renders carries its input's id, so this shouldn't fire —
 * it exists so a stray handle-less wire lands on a real port instead of
 * serializing an empty string that `parsePreset` would then reject on load.
 */
function firstInputIdOf(nodes: CardNodeType[], nodeId: string): string {
  const node = nodes.find((candidate) => candidate.id === nodeId);

  return node ? (NODE_SPECS[node.data.spec].inputs[0]?.id ?? '') : '';
}

// ---------------------------------------------------------------------------
// Preset -> Canvas
// ---------------------------------------------------------------------------

/**
 * Rebuilds React Flow's nodes and edges from a preset. Cards come back
 * unselected with their params panel shut (neither is saved state), and wire
 * ids are derived from the connection itself rather than a counter — an input
 * holds exactly one wire, so `source->target:handle` is already unique and
 * stays stable across repeated restores.
 */
export function flowFromPreset(preset: Preset): { nodes: CardNodeType[]; edges: Edge[] } {
  const specById = new Map(preset.nodes.map((node) => [node.id, node.spec]));

  const nodes = preset.nodes.map((node) => ({
    ...makeNode(node.id, node.spec, node.position.x, node.position.y),
    data: { spec: node.spec, params: node.params },
  }));

  const edges = preset.edges.map((edge) =>
    typedEdge(
      {
        id: `${edge.source}->${edge.target}:${edge.targetHandle}`,
        source: edge.source,
        target: edge.target,
        targetHandle: edge.targetHandle,
      },
      tintOf(specById.get(edge.source)),
    ),
  );

  return { nodes, edges };
}

/**
 * Pushes a preset's live-driven values into the uniform store. Restoring a
 * graph is not enough on its own: uniforms are created once per (node, param)
 * and handed back unchanged forever after (ParamStore), so `uniformFor`'s
 * `initial` argument is ignored on every call but the first. Without this
 * pass an undo would restore React state while the GPU kept rendering the
 * values it was already holding.
 *
 * Only slider and ramp params need it — select params are baked into the
 * compiled material, so they come back with the rebuild the structural key
 * triggers.
 */
export function pushPresetToStore(preset: Preset, paramStore: ParamStore): void {
  for (const node of preset.nodes) {
    for (const param of NODE_SPECS[node.spec].params) {
      if (param.kind === 'slider') {
        const value = node.params[param.id];

        if (typeof value === 'number') {
          paramStore.set(node.id, param.id, value);
        }
      }

      if (param.kind === 'ramp') {
        rampStopsOf(node, param.id).forEach((stop, index) => {
          paramStore.setStopPosition(node.id, index, stop.position);
          paramStore.setStopColor(node.id, index, parseColorString(stop.color));
        });
      }
    }
  }
}

// Builds the preset-shaped payloads copy/paste moves around. Copy narrows
// the live graph down to the selected subgraph (`selectionToPreset`); paste
// takes that payload and gives it a fresh identity that can't collide with
// what's already on the canvas (`remapForPaste`). Both share the `Preset`
// shape from ./preset so a clipboard payload is, structurally, just a
// preset -- no separate serialization format to keep in sync.
import type { Preset, PresetEdge, PresetNode } from './preset';
import { presetFrom } from './preset';

/** Pixels a pasted node's position is nudged by on both axes, so a paste
    lands visibly offset from its source instead of stacking exactly on top. */
export const PASTE_OFFSET = 24;

/**
 * Narrows a selection down to a preset: only the selected nodes, plus edges
 * whose source AND target are both selected. Output nodes are dropped even
 * when selected -- Output is a singleton the canvas always has exactly one
 * of, so it can never be copied -- which in turn drops any edge that fed
 * into it, since that edge's target no longer survives.
 */
export function selectionToPreset(
  nodes: PresetNode[],
  edges: PresetEdge[],
  selectedIds: ReadonlySet<string>,
): Preset {
  const copiedNodes = nodes.filter((node) => selectedIds.has(node.id) && node.spec !== 'output');
  const copiedIds = new Set(copiedNodes.map((node) => node.id));
  const copiedEdges = edges.filter(
    (edge) => copiedIds.has(edge.source) && copiedIds.has(edge.target),
  );

  return presetFrom(copiedNodes, copiedEdges);
}

/**
 * Gives a copied preset a fresh identity for pasting: every node gets a new
 * `${spec}-${n}` id (the smallest positive n not already taken -- by the
 * live canvas, via `takenIds`, or by an id this same remap has already
 * handed out), nudged `PASTE_OFFSET` px on both axes so it doesn't land
 * exactly on top of its source, and every edge rewritten to point at the
 * remapped ids so internal wiring survives the rename.
 */
export function remapForPaste(
  preset: Preset,
  takenIds: ReadonlySet<string>,
): { nodes: PresetNode[]; edges: PresetEdge[] } {
  const idMap = new Map<string, string>();
  const assignedIds = new Set<string>();

  const nodes = preset.nodes.map((node) => {
    const freshId = nextFreeId(node.spec, takenIds, assignedIds);

    assignedIds.add(freshId);
    idMap.set(node.id, freshId);

    return {
      ...node,
      id: freshId,
      position: { x: node.position.x + PASTE_OFFSET, y: node.position.y + PASTE_OFFSET },
      // Deep-copied: duplicate composes remap without a serialization round
      // trip, so a shallow spread would leave the pasted card's params (and
      // nested ramp stops) aliasing the live source node's objects.
      params: structuredClone(node.params),
    };
  });

  const edges = preset.edges.map((edge) => ({
    ...edge,
    source: idMap.get(edge.source) ?? edge.source,
    target: idMap.get(edge.target) ?? edge.target,
  }));

  return { nodes, edges };
}

/** Finds the smallest positive `n` such that `${spec}-${n}` is free of both
    the caller's already-live ids and any id this remap pass has already
    handed out -- the latter guard is what keeps two nodes of the same spec
    in one paste from colliding with each other. */
function nextFreeId(
  spec: string,
  takenIds: ReadonlySet<string>,
  assignedIds: ReadonlySet<string>,
): string {
  let candidateNumber = 1;
  let candidateId = `${spec}-${candidateNumber}`;

  while (takenIds.has(candidateId) || assignedIds.has(candidateId)) {
    candidateNumber += 1;
    candidateId = `${spec}-${candidateNumber}`;
  }

  return candidateId;
}

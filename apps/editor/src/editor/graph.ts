// Graph model shared by the canvas, compiler, and code emitter: plain nodes
// and edges (no React Flow or three types), plus the structural key that
// decides when a change is cheap (ride a uniform) versus expensive (rebuild
// the material). Kept three-free so the compiler and emitter can import it
// into contexts that never touch WebGPU.
import type { ColorStop, ParamValue, SpecId } from './registry';
import { NODE_SPECS } from './registry';

/** One macro-node instance on the canvas: which spec it is, and its dial values. */
export interface GraphNode {
  id: string;
  spec: SpecId;
  params: Record<string, ParamValue>;
}

/** One wire between two nodes. `targetHandle` picks which input port on a
    multi-input node (e.g. Warp's `by`); single-input nodes can omit it. */
export interface GraphEdge {
  source: string;
  target: string;
  targetHandle?: string | null;
}

/**
 * Builds the fingerprint the material effects key on. Wiring and specs are
 * always structural (they change which nodes exist and how they connect).
 * Within a node's params: select params compile to different math, so they
 * belong in the key; ramp params bake their stop COUNT into the mix chain's
 * arity, so the count belongs too — but the stop colors/positions ride
 * uniforms and stay out; slider params ride uniforms outright and stay out
 * entirely. The registry's declared kind decides which is which — not the
 * value's runtime type, which only coincidentally separates them today. Spec
 * order is fixed, so the entries are deterministic without sorting.
 */
export function structuralKeyOf(nodes: GraphNode[], edges: GraphEdge[]): string {
  const nodePart = nodes
    .map((node) => {
      const baked = NODE_SPECS[node.spec].params
        .filter((param) => param.kind === 'select' || param.kind === 'ramp')
        .map((param) => {
          if (param.kind === 'ramp') {
            const stops = rampStopsOf(node, param.id);

            return [param.id, stops.length];
          }

          return [param.id, node.params[param.id] ?? param.defaultValue];
        });

      return `${node.id}:${node.spec}:${JSON.stringify(baked)}`;
    })
    .sort();
  const edgePart = edges
    .map((edge) => `${edge.source}>${edge.target}@${edge.targetHandle ?? ''}`)
    .sort();

  return JSON.stringify([nodePart, edgePart]);
}

/**
 * The single defensive ramp read: a node's stored param value is only
 * trusted when it's actually an array (a fresh node, a malformed load, or a
 * mid-edit state can leave it missing or the wrong shape), otherwise this
 * falls back to the spec's default stops. Callers (the compiler, the code
 * emitter, the ramp param editor) all need this same fallback, so it lives
 * here once instead of being re-implemented at each call site.
 */
export function rampStopsOf(node: GraphNode, paramId = 'stops'): ColorStop[] {
  const value = node.params[paramId];

  if (Array.isArray(value)) {
    return value;
  }

  const param = NODE_SPECS[node.spec].params.find((candidate) => candidate.id === paramId);

  if (param?.kind === 'ramp') {
    return structuredClone(param.defaultValue);
  }

  return [];
}

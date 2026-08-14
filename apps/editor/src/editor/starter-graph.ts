// The prewired starter graph — gradient warped by noise, blended with that
// same noise, colorized, into Output — as pure data. Editor.tsx hydrates it
// into React Flow nodes; the emit test (Task 16+) feeds it to the code
// generator. Kept three-free so a Node process can import it.
import type { SpecId } from './registry';

export interface StarterNode {
  id: string;
  spec: SpecId;
  x: number;
  y: number;
}

export const STARTER_NODES = [
  { id: 'gradient-1', spec: 'gradient', x: 30, y: 40 },
  { id: 'noise-1', spec: 'noise', x: 30, y: 290 },
  { id: 'warp-1', spec: 'warp', x: 260, y: 80 },
  { id: 'blend-1', spec: 'blend', x: 470, y: 170 },
  { id: 'ramp-1', spec: 'colorRamp', x: 680, y: 165 },
  { id: 'output-1', spec: 'output', x: 890, y: 110 },
] as const satisfies readonly StarterNode[];

/** Only declared node ids can be wired — a typo'd edge fails to compile. */
type StarterNodeId = (typeof STARTER_NODES)[number]['id'];

interface StarterEdge {
  source: StarterNodeId;
  target: StarterNodeId;
  /** Input handle ids the starter wiring uses (see NODE_SPECS inputs). */
  targetHandle: 'source' | 'by' | 'in' | 'with';
}

// Teaches fan-out: Noise feeds BOTH Warp's `by` driver and Blend's `with`
// overlay, so the same field ends up shaping the pattern twice, once as a
// displacement and once as a mix — the concept mock's canonical example.
export const STARTER_EDGES: StarterEdge[] = [
  { source: 'gradient-1', target: 'warp-1', targetHandle: 'source' },
  { source: 'noise-1', target: 'warp-1', targetHandle: 'by' },
  { source: 'warp-1', target: 'blend-1', targetHandle: 'in' },
  { source: 'noise-1', target: 'blend-1', targetHandle: 'with' },
  { source: 'blend-1', target: 'ramp-1', targetHandle: 'in' },
  { source: 'ramp-1', target: 'output-1', targetHandle: 'in' },
];

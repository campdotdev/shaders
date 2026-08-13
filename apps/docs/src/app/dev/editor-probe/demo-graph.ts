// The prewired demo graph — gradient warped by noise, colorized, into Output —
// as pure data. editor.tsx hydrates it into React Flow nodes; the emit test
// feeds it to the code generator. Kept three-free so a Node process can
// import it.
import type { SpecId } from './registry';

export interface DemoNode {
  id: string;
  spec: SpecId;
  x: number;
  y: number;
}

export const DEMO_NODES: DemoNode[] = [
  { id: 'gradient-1', spec: 'gradient', x: 30, y: 60 },
  { id: 'noise-1', spec: 'noise', x: 30, y: 300 },
  { id: 'warp-1', spec: 'warp', x: 270, y: 170 },
  { id: 'ramp-1', spec: 'colorRamp', x: 500, y: 165 },
  { id: 'output-1', spec: 'output', x: 720, y: 120 },
];

export const DEMO_EDGES = [
  { source: 'gradient-1', target: 'warp-1', targetHandle: 'source' },
  { source: 'noise-1', target: 'warp-1', targetHandle: 'by' },
  { source: 'warp-1', target: 'ramp-1', targetHandle: 'in' },
  { source: 'ramp-1', target: 'output-1', targetHandle: 'in' },
];

// Node vocabulary for the shader editor spike. Each entry is one "macro node":
// a whole Matter primitive presented as a single card, never a raw TSL op.
// Users only ever see two port types — field (a grayscale value per pixel) and
// color. Every port carries exactly one small word: "in"/"out" for the main
// flow, prepositions ("by", "with", "using") for modifier inputs — never vague
// nouns ("source") or jargon ("driver").

export type PortType = 'field' | 'color';

export interface InputSpec {
  /** stable handle id, used by React Flow edges and by the compiler */
  id: string;
  /** one-word label drawn next to the input port */
  label: string;
  type: PortType;
}

/**
 * A node's dials. Sliders ride per-node uniforms, so dragging one glides
 * without recompiling the shader. Selects bake into the compiled shader
 * (different math per option), so changing one rebuilds the material — they
 * join the structural key for exactly that reason.
 */
export type ParamSpec =
  | {
      id: string;
      label: string;
      kind: 'slider';
      min: number;
      max: number;
      step: number;
      defaultValue: number;
    }
  | { id: string; label: string; kind: 'select'; options: string[]; defaultValue: string };

export interface NodeSpec {
  /** everyday-word display name (never GPU jargon) */
  name: string;
  /** grouping shown as the card's small kind tag */
  kind: 'generate' | 'modify' | 'color' | 'output';
  inputs: InputSpec[];
  /** what the node emits; the Output card emits nothing */
  output: PortType | null;
  params: ParamSpec[];
}

/** Wire and port tint per type: teal for fields, violet for color. */
export const PORT_COLORS: Record<PortType, string> = {
  field: '#2dd4bf',
  color: '#a78bfa',
};

// Shared shader constants live here (not in compile.ts) so the code EMITTER
// and its node-run test can import them without dragging three/webgpu — which
// references `self` at module load — into a Node process.

/**
 * Offset between the two driver taps that build the warp vector. Sampling the
 * same scalar field at two far-apart spots yields two uncorrelated values, so
 * the push direction varies across the canvas instead of sliding diagonally.
 */
export const DRIVER_DECORRELATE = [5.2, 1.3] as const;

/** Demo palette: deep indigo through violet to pink, mixed in oklab. */
export const RAMP_HEX = ['#1B2A6B', '#7C3AED', '#F472B6'] as const;

/**
 * Warp reads its driver field twice (once per decorrelated tap), so warps
 * chained through the `by` port double the evaluated tree at every level —
 * 2^n growth. Past this nesting depth a warp ignores its driver and passes
 * its source through, so a playful wire-up degrades gracefully instead of
 * freezing the tab on shader compile. Both backends honor it: the runtime
 * compiler builds the doubling tree directly, and while the code emitter's
 * TEXT stays linear (helpers are shared by name), the generated component
 * builds the same doubling tree when it runs.
 */
export const MAX_WARP_DRIVER_DEPTH = 4;

export const NODE_SPECS = {
  gradient: {
    name: 'Gradient',
    kind: 'generate',
    inputs: [],
    output: 'field',
    params: [
      { id: 'angle', label: 'angle', kind: 'slider', min: 0, max: 360, step: 1, defaultValue: 45 },
    ],
  },
  noise: {
    name: 'Noise',
    kind: 'generate',
    inputs: [],
    output: 'field',
    params: [
      {
        id: 'scale',
        label: 'scale',
        kind: 'slider',
        min: 0.5,
        max: 10,
        step: 0.1,
        defaultValue: 3,
      },
      {
        id: 'speed',
        label: 'speed',
        kind: 'slider',
        min: 0,
        max: 1,
        step: 0.01,
        defaultValue: 0.15,
      },
    ],
  },
  warp: {
    name: 'Warp',
    kind: 'modify',
    // The "by" field is the displacement driver: bright areas push the
    // sampling coordinates further, dark areas leave them alone.
    inputs: [
      { id: 'source', label: 'in', type: 'field' },
      { id: 'by', label: 'by', type: 'field' },
    ],
    output: 'field',
    params: [
      {
        id: 'amount',
        label: 'amount',
        kind: 'slider',
        min: 0,
        max: 1,
        step: 0.01,
        defaultValue: 0.35,
      },
    ],
  },
  curve: {
    name: 'Curve',
    kind: 'modify',
    inputs: [{ id: 'in', label: 'in', type: 'field' }],
    output: 'field',
    params: [
      { id: 'bend', label: 'bend', kind: 'slider', min: -1, max: 1, step: 0.01, defaultValue: 0 },
    ],
  },
  blend: {
    name: 'Blend',
    kind: 'modify',
    inputs: [
      { id: 'in', label: 'in', type: 'field' },
      { id: 'with', label: 'with', type: 'field' },
    ],
    output: 'field',
    params: [
      {
        id: 'mode',
        label: 'mode',
        kind: 'select',
        options: ['mix', 'multiply', 'screen'],
        defaultValue: 'mix',
      },
      {
        id: 'amount',
        label: 'amount',
        kind: 'slider',
        min: 0,
        max: 1,
        step: 0.01,
        defaultValue: 0.5,
      },
    ],
  },
  colorRamp: {
    name: 'Color Ramp',
    kind: 'color',
    inputs: [{ id: 'in', label: 'in', type: 'field' }],
    output: 'color',
    params: [],
  },
  // The first COLOR-stage adjustment: color in, color out, sits between
  // Color Ramp and Output. Same one-dial curve as Curve, but bending the
  // finished image's tones instead of a grayscale pattern — the Photoshop
  // "adjustment layer" mental model. Named Tone (as in "tone curve") so the
  // toolbar never shows two nodes both called Curve.
  tone: {
    name: 'Tone',
    kind: 'color',
    inputs: [{ id: 'in', label: 'in', type: 'color' }],
    output: 'color',
    params: [
      { id: 'bend', label: 'bend', kind: 'slider', min: -1, max: 1, step: 0.01, defaultValue: 0 },
    ],
  },
  output: {
    name: 'Output',
    kind: 'output',
    inputs: [{ id: 'in', label: 'in', type: 'color' }],
    output: null,
    params: [],
  },
} satisfies Record<string, NodeSpec>;

export type SpecId = keyof typeof NODE_SPECS;

/** Fresh param values for a new node instance: every spec default, by id. */
export function defaultParamsOf(spec: SpecId): Record<string, number | string> {
  return Object.fromEntries(NODE_SPECS[spec].params.map((param) => [param.id, param.defaultValue]));
}

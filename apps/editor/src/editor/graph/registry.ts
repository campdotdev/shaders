// Node vocabulary for the shader editor. Each entry is one "macro node": a
// whole Matter primitive presented as a single card, never a raw TSL op.
// Users only ever see two port types — field (a grayscale value per pixel) and
// color. Every port carries exactly one small word: "in"/"out" for the main
// flow, prepositions ("by", "with", "using") for modifier inputs — never vague
// nouns ("source") or jargon ("driver").
//
// Cards are grouped into four stages that read left to right across the
// canvas: generate (make a field) -> effect (reshape a field) -> color (turn
// a field into color) -> adjust (grade the finished color). Output sits after
// adjust and stays untinted, since it isn't a stage of transformation itself.

export type PortType = 'field' | 'color';

export type Stage = 'generate' | 'effect' | 'color' | 'adjust' | 'output';

export interface InputSpec {
  /** stable handle id, used by React Flow edges and by the compiler */
  id: string;
  /** one-word label drawn next to the input port */
  label: string;
  type: PortType;
}

/** A single stop on a color ramp: a color and its position along the ramp. */
export interface ColorStop {
  /** Hex, `oklch()`, or `oklab()` string — the only forms parseColorString accepts. */
  color: string;
  /** 0..1 position along the ramp. */
  position: number;
}

export type ParamValue = number | string | ColorStop[];

/**
 * A node's dials. Sliders ride per-node uniforms, so dragging one glides
 * without recompiling the shader. Selects bake into the compiled shader
 * (different math per option), so changing one rebuilds the material — they
 * join the structural key for exactly that reason. Ramps bake into the
 * shader too (colorRamp's stops are literals), so editing one also rebuilds.
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
  | { id: string; label: string; kind: 'select'; options: string[]; defaultValue: string }
  | { id: string; label: string; kind: 'ramp'; defaultValue: ColorStop[] };

export interface NodeSpec {
  /** everyday-word display name (never GPU jargon) */
  name: string;
  /** grouping shown as the card's small stage tag, and its body tint */
  stage: Stage;
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

/** Stage tint per card body; Output stays untinted. The color stage wears the
    color PORT violet on purpose — the stage where color enters the graph. */
export const STAGE_COLORS: Record<Exclude<Stage, 'output'>, string> = {
  generate: '#60a5fa',
  effect: '#f59e0b',
  color: '#a78bfa',
  adjust: '#fb7185',
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
export const DEFAULT_RAMP_STOPS: ColorStop[] = [
  { color: '#1B2A6B', position: 0 },
  { color: '#7C3AED', position: 0.5 },
  { color: '#F472B6', position: 1 },
];

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

// --- Tuning-gate constants (provisional; settled by eye at the Task 10/11 gates) ---
/** Seed orbit radius behind the Voronoi card's speed dial — 0 would freeze it. */
export const VORONOI_DRIFT = 0.6;
/** Multiplier turning raw edge distance (pattern units) into a 0..1 field. */
export const VORONOI_EDGE_GAIN = 2.5;
/** smoothstep window turning the summed metaball field into a goo silhouette. */
export const BLOBS_THRESHOLD = [0.3, 0.6] as const;
/** Octave count for the Fractal Noise card (fixed: octaves unroll at build time). */
export const FRACTAL_OCTAVES = 5;

/** Which turbulence fold each style asks fractalNoise for (mirrors registry/fractal-noise). */
export const FRACTAL_STYLE_FOLD = { clouds: 'none', smoke: 'smooth', veins: 'sharp' } as const;
/** Per-style remap of the raw fBm sum onto 0..1: clamp(raw * stretch + lift, 0, 1). */
export const FRACTAL_STYLE_REMAP = {
  clouds: { stretch: 0.5, lift: 0.5 },
  smoke: { stretch: 1.6, lift: 0.18 },
  veins: { stretch: 1.4, lift: -0.28 },
} as const;

export const NODE_SPECS = {
  gradient: {
    name: 'Gradient',
    stage: 'generate',
    inputs: [],
    output: 'field',
    params: [
      { id: 'angle', label: 'angle', kind: 'slider', min: 0, max: 360, step: 1, defaultValue: 45 },
    ],
  },
  noise: {
    name: 'Noise',
    stage: 'generate',
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
  fractalNoise: {
    name: 'Fractal Noise',
    stage: 'generate',
    inputs: [],
    output: 'field',
    params: [
      {
        id: 'style',
        label: 'style',
        kind: 'select',
        options: ['clouds', 'smoke', 'veins'],
        defaultValue: 'clouds',
      },
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
  voronoi: {
    name: 'Voronoi',
    stage: 'generate',
    inputs: [],
    output: 'field',
    params: [
      { id: 'scale', label: 'scale', kind: 'slider', min: 1, max: 12, step: 0.5, defaultValue: 4 },
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
  blobs: {
    name: 'Blobs',
    stage: 'generate',
    inputs: [],
    output: 'field',
    params: [
      { id: 'count', label: 'count', kind: 'slider', min: 1, max: 20, step: 1, defaultValue: 8 },
      { id: 'size', label: 'size', kind: 'slider', min: 0, max: 1, step: 0.01, defaultValue: 0.5 },
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
    stage: 'effect',
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
  blend: {
    name: 'Blend',
    stage: 'effect',
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
    stage: 'color',
    inputs: [{ id: 'in', label: 'in', type: 'field' }],
    output: 'color',
    params: [{ id: 'stops', label: 'stops', kind: 'ramp', defaultValue: DEFAULT_RAMP_STOPS }],
  },
  // The first ADJUST-stage card: color in, color out, sits between Color Ramp
  // and Output. A one-dial pow() bend, but on the finished image's tones
  // instead of a grayscale pattern — the Photoshop "adjustment layer" mental
  // model. Named Tone (as in "tone curve").
  tone: {
    name: 'Tone',
    stage: 'adjust',
    inputs: [{ id: 'in', label: 'in', type: 'color' }],
    output: 'color',
    params: [
      { id: 'bend', label: 'bend', kind: 'slider', min: -1, max: 1, step: 0.01, defaultValue: 0 },
    ],
  },
  levels: {
    name: 'Levels',
    stage: 'adjust',
    inputs: [{ id: 'in', label: 'in', type: 'color' }],
    output: 'color',
    params: [
      {
        id: 'black',
        label: 'black',
        kind: 'slider',
        min: 0,
        max: 0.5,
        step: 0.01,
        defaultValue: 0,
      },
      {
        id: 'white',
        label: 'white',
        kind: 'slider',
        min: 0.5,
        max: 1,
        step: 0.01,
        defaultValue: 1,
      },
      {
        id: 'gamma',
        label: 'gamma',
        kind: 'slider',
        min: 0.25,
        max: 4,
        step: 0.01,
        defaultValue: 1,
      },
    ],
  },
  vignette: {
    name: 'Vignette',
    stage: 'adjust',
    inputs: [{ id: 'in', label: 'in', type: 'color' }],
    output: 'color',
    params: [
      {
        id: 'coverage',
        label: 'coverage',
        kind: 'slider',
        min: 0,
        max: 1,
        step: 0.01,
        defaultValue: 0.55,
      },
      {
        id: 'softness',
        label: 'softness',
        kind: 'slider',
        min: 0,
        max: 1,
        step: 0.01,
        defaultValue: 0.35,
      },
    ],
  },
  grain: {
    name: 'Grain',
    stage: 'adjust',
    inputs: [{ id: 'in', label: 'in', type: 'color' }],
    output: 'color',
    params: [
      {
        id: 'amount',
        label: 'amount',
        kind: 'slider',
        min: 0,
        max: 0.5,
        step: 0.01,
        defaultValue: 0.12,
      },
    ],
  },
  output: {
    name: 'Output',
    stage: 'output',
    inputs: [{ id: 'in', label: 'in', type: 'color' }],
    output: null,
    params: [],
  },
} satisfies Record<string, NodeSpec>;

export type SpecId = keyof typeof NODE_SPECS;

/**
 * Whether a wire from a port of `sourceType` may land on `targetSpec`'s input
 * `targetType`. The rule is "same colors connect", with ONE exception: the
 * Output card's `in` also accepts a field — a bare pattern renders as its
 * grayscale image, so any teal wire can be inspected without routing it
 * through a ramp first. Output is display-only, which is why the exception is
 * safe: no downstream math ever sees the promoted value. The reverse
 * (color into a field input) stays forbidden — collapsing three channels to
 * one requires choosing math, and hidden choices don't belong on wires.
 */
export function portsCompatible(
  sourceType: PortType,
  targetSpecId: SpecId,
  targetType: PortType,
): boolean {
  if (sourceType === targetType) return true;

  return targetSpecId === 'output' && targetType === 'color' && sourceType === 'field';
}

/**
 * Fresh param values for a new node instance: every spec default, by id.
 * Ramp defaults are deep-copied (`structuredClone`) — without it every
 * Color Ramp card on the canvas would share and mutate the same stops array.
 */
export function defaultParamsOf(spec: SpecId): Record<string, ParamValue> {
  return Object.fromEntries(
    NODE_SPECS[spec].params.map((param) => [
      param.id,
      param.kind === 'ramp' ? structuredClone(param.defaultValue) : param.defaultValue,
    ]),
  );
}

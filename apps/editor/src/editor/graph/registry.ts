// Node vocabulary for the shader editor. Each entry is one "macro node": a
// whole Shaders primitive presented as a single card, never a raw TSL op.
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
 *
 * The two point-and-swatch kinds ride uniforms like sliders do:
 * - `xy` is a labeled pair of sliders (a point like Vignette's center). It
 *   STORES as two plain number params keyed `${id}.x` / `${id}.y`, so every
 *   layer below the panel UI — the param store, presets, undo — sees only
 *   numbers it already knows how to handle.
 * - `color` stores its color string in the params bag (same value shape as a
 *   select) but rides a vec3 uniform, so repicking never rebuilds — which is
 *   why the structural key filters by declared kind, not value type.
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
  | { id: string; label: string; kind: 'ramp'; defaultValue: ColorStop[] }
  | {
      id: string;
      label: string;
      kind: 'xy';
      min: number;
      max: number;
      step: number;
      defaultValue: readonly [number, number];
    }
  | { id: string; label: string; kind: 'color'; defaultValue: string };

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
/** Multiplier turning raw edge distance (pattern units) into a 0..1 field. */
export const VORONOI_EDGE_GAIN = 2.5;
/**
 * The Blobs goo edge (mirrors registry/blobs): the field crosses into "goo"
 * at THRESHOLD, and the softness dial feathers the crossing by up to
 * MAX_SOFTNESS field units on top of the fwidth anti-aliasing floor.
 */
export const BLOBS_EDGE = { threshold: 0.4, maxSoftness: 0.35 } as const;
/** Octave count for the Fractal Noise card (fixed: octaves unroll at build time). */
export const FRACTAL_OCTAVES = 5;

/** Which turbulence fold each style asks fractalNoise for (mirrors registry/fractal-noise). */
export const FRACTAL_STYLE_FOLD = { clouds: 'none', smoke: 'smooth', veins: 'sharp' } as const;
/**
 * The detail dial (0..1) maps onto fBm gain — the per-octave amplitude
 * falloff — inside this range (mirrors registry/fractal-noise's GAIN_MIN/
 * GAIN_MAX). detail 0.5 lands exactly on the engine's default gain of 0.5,
 * so the dial's default is a true identity.
 */
export const FRACTAL_GAIN_RANGE = { min: 0.15, max: 0.85 } as const;
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
    // MAT-99: repeat and speed, both gate-at-identity like the docs
    // LinearGradient — repeat <= 1 is bit-for-bit the single-pass ramp, and
    // speed 0 is bit-for-bit static, so the defaults change nothing.
    params: [
      { id: 'angle', label: 'angle', kind: 'slider', min: 0, max: 360, step: 1, defaultValue: 45 },
      {
        id: 'repeat',
        label: 'repeat',
        kind: 'slider',
        min: 1,
        max: 10,
        step: 0.1,
        defaultValue: 1,
      },
      { id: 'speed', label: 'speed', kind: 'slider', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    ],
  },
  noise: {
    name: 'Noise',
    stage: 'generate',
    inputs: [],
    output: 'field',
    // MAT-99 added the docs SimplexNoise's field-shaping dials. Defaults are
    // identity (contrast 1, balance 0.5), so pre-parity graphs look the same.
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
        id: 'contrast',
        label: 'contrast',
        kind: 'slider',
        min: 0,
        max: 4,
        step: 0.01,
        defaultValue: 1,
      },
      {
        id: 'balance',
        label: 'balance',
        kind: 'slider',
        min: 0,
        max: 1,
        step: 0.01,
        defaultValue: 0.5,
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
    // MAT-99 added detail (fBm gain) plus the shared shaping pair. Identity
    // defaults again: detail 0.5 IS the engine's default gain, contrast 1 and
    // balance 0.5 shape nothing.
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
        id: 'detail',
        label: 'detail',
        kind: 'slider',
        min: 0,
        max: 1,
        step: 0.01,
        defaultValue: 0.5,
      },
      {
        id: 'contrast',
        label: 'contrast',
        kind: 'slider',
        min: 0.2,
        max: 5,
        step: 0.05,
        defaultValue: 1,
      },
      {
        id: 'balance',
        label: 'balance',
        kind: 'slider',
        min: 0,
        max: 1,
        step: 0.01,
        defaultValue: 0.5,
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
    // MAT-99: shading blends the field's identity — 1 is the v1 edge-distance
    // field (identity default), 0 is a flat random-per-cell mosaic. drift was
    // a hidden constant (0.6, tuned at the v1 gates) now exposed as a dial;
    // irregularity rides the primitive's jitter, whose default is already 1.
    params: [
      { id: 'scale', label: 'scale', kind: 'slider', min: 1, max: 12, step: 0.5, defaultValue: 4 },
      {
        id: 'shading',
        label: 'shading',
        kind: 'slider',
        min: 0,
        max: 1,
        step: 0.01,
        defaultValue: 1,
      },
      {
        id: 'irregularity',
        label: 'irregularity',
        kind: 'slider',
        min: 0,
        max: 1,
        step: 0.01,
        defaultValue: 1,
      },
      {
        id: 'drift',
        label: 'drift',
        kind: 'slider',
        min: 0,
        max: 1,
        step: 0.01,
        defaultValue: 0.6,
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
  blobs: {
    name: 'Blobs',
    stage: 'generate',
    inputs: [],
    output: 'field',
    // MAT-99: variation/spread defaults sit on the engine's own defaults
    // (identity), center is the canvas center, and softness 0.4 mirrors the
    // docs Blobs' edge feather — the one dial whose default subtly reshapes
    // the goo edge versus v1's fixed smoothstep window (flagged at the gate).
    params: [
      { id: 'count', label: 'count', kind: 'slider', min: 1, max: 20, step: 1, defaultValue: 8 },
      { id: 'size', label: 'size', kind: 'slider', min: 0, max: 1, step: 0.01, defaultValue: 0.5 },
      {
        id: 'sizeVariation',
        label: 'variation',
        kind: 'slider',
        min: 0,
        max: 1,
        step: 0.01,
        defaultValue: 0,
      },
      {
        id: 'spread',
        label: 'spread',
        kind: 'slider',
        min: 0,
        max: 1,
        step: 0.01,
        defaultValue: 0.5,
      },
      {
        id: 'softness',
        label: 'softness',
        kind: 'slider',
        min: 0,
        max: 1,
        step: 0.01,
        defaultValue: 0.4,
      },
      {
        id: 'center',
        label: 'center',
        kind: 'xy',
        min: 0,
        max: 1,
        step: 0.01,
        defaultValue: [0.5, 0.5],
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
    // MAT-99 brought this card to dial parity with the docs Vignette:
    // strength/center/color joined coverage/softness (which map to the docs
    // component's radius/feather). Defaults reproduce the pre-parity look —
    // full-strength fade to black from the canvas center.
    params: [
      {
        id: 'strength',
        label: 'strength',
        kind: 'slider',
        min: 0,
        max: 1,
        step: 0.01,
        defaultValue: 1,
      },
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
      {
        id: 'center',
        label: 'center',
        kind: 'xy',
        min: 0,
        max: 1,
        step: 0.01,
        defaultValue: [0.5, 0.5],
      },
      { id: 'color', label: 'color', kind: 'color', defaultValue: 'oklch(0 0 0)' },
    ],
  },
  grain: {
    name: 'Grain',
    stage: 'adjust',
    inputs: [{ id: 'in', label: 'in', type: 'color' }],
    output: 'color',
    // MAT-99: speed re-rolls the pattern in discrete ticks (0 = frozen, the
    // v1 behavior); blend picks additive sparkle (v1's math) or
    // subtractive dark specks — a select, so changing it rebuilds.
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
      {
        id: 'blend',
        label: 'blend',
        kind: 'select',
        options: ['additive', 'subtractive'],
        defaultValue: 'additive',
      },
      { id: 'speed', label: 'speed', kind: 'slider', min: 0, max: 1, step: 0.01, defaultValue: 0 },
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

/** The two storage keys behind an xy param: `${id}.x` and `${id}.y`. */
export function xyKeysOf(paramId: string): [string, string] {
  return [`${paramId}.x`, `${paramId}.y`];
}

/**
 * Fresh param values for a new node instance: every spec default, by id.
 * Ramp defaults are deep-copied (`structuredClone`) — without it every
 * Color Ramp card on the canvas would share and mutate the same stops array.
 * An xy param expands into its two number keys here, so the stored bag never
 * holds a tuple.
 */
export function defaultParamsOf(spec: SpecId): Record<string, ParamValue> {
  return Object.fromEntries(
    NODE_SPECS[spec].params.flatMap((param): Array<[string, ParamValue]> => {
      if (param.kind === 'xy') {
        const [xKey, yKey] = xyKeysOf(param.id);

        return [
          [xKey, param.defaultValue[0]],
          [yKey, param.defaultValue[1]],
        ];
      }

      return [
        [
          param.id,
          param.kind === 'ramp' ? structuredClone(param.defaultValue) : param.defaultValue,
        ],
      ];
    }),
  );
}

// The graph-to-TSL compiler for the editor spike: walks the card graph from an
// Output node backward and assembles a TSL color expression from Matter's Tier 2
// primitives. The core representation: a compiled field is a FUNCTION of the
// sample position, `(p) => value`, not a value — that's what lets Warp work,
// because warping IS calling the upstream field at a shifted position. Slider
// params ride per-node uniforms from the ParamStore (drags glide, no rebuild);
// select params (Blend's mode) bake into the shader and rebuild on change.
import { colorRamp, displace, elapsedTime, simplexNoise } from '@lovo/matter';
import { parseColorString } from '@lovo/matter/color';
import { clamp, cos, dot, exp2, float, mix, pow, sin, uv, vec2, vec3 } from 'three/tsl';
import type { ShaderNodeObject } from 'three/tsl';
import type { Node } from 'three/webgpu';

import type { ParamStore } from './param-store';
import { DRIVER_DECORRELATE, RAMP_HEX } from './registry';
import type { SpecId } from './registry';

type TSLNode = ShaderNodeObject<Node>;

/** A field: grayscale value (0..1) as a function of sample position (vec2). */
type FieldFn = (samplePoint: TSLNode) => TSLNode;

/** The minimal graph shape the compiler reads — decoupled from React Flow types. */
export interface GraphNode {
  id: string;
  spec: SpecId;
  params: Record<string, number | string>;
}
export interface GraphEdge {
  source: string;
  target: string;
  targetHandle?: string | null;
}

// Fixed character constants (DRIVER_DECORRELATE, RAMP_HEX) live in
// registry.ts so the code emitter shares them without importing three.

/**
 * Warp emits its driver subtree TWICE (once per decorrelated tap), so warps
 * chained through the `by` port double the emitted expression tree at every
 * level — 2^n growth. Past this nesting depth a warp ignores its driver and
 * passes its source through, so a playful wire-up degrades gracefully instead
 * of freezing the tab on shader compile.
 */
const MAX_WARP_DRIVER_DEPTH = 4;

const DEGREES_TO_RADIANS = Math.PI / 180;

// ---------------------------------------------------------------------------
// The walk
// ---------------------------------------------------------------------------

/**
 * Compiles the subgraph feeding `outputId` into a TSL color expression, ready
 * to assign to `material.colorNode`. Unconnected inputs fall back to flat
 * mid-gray (fields) or a dim slate (colors), so a half-built graph still
 * renders something legible instead of failing.
 */
export function compileOutputColor(
  nodes: GraphNode[],
  edges: GraphEdge[],
  outputId: string,
  params: ParamStore,
): TSLNode {
  const nodesById = new Map(nodes.map((node) => [node.id, node]));

  /** The node feeding a given input port, or null when the port is unwired. */
  function upstreamOf(nodeId: string, handleId: string): GraphNode | null {
    const edge = edges.find(
      (candidate) => candidate.target === nodeId && candidate.targetHandle === handleId,
    );

    return edge ? (nodesById.get(edge.source) ?? null) : null;
  }

  /** The stable uniform behind one of `node`'s sliders, seeded with its current value. */
  // Return type left inferred: UniformNode's ShaderNodeObject wrapper is not
  // assignable to the plain-Node wrapper (variance quirk in three's TSL
  // types), but chaining .mul()/.sub() off it works and lands back on plain
  // nodes.
  function dial(node: GraphNode, paramId: string) {
    return params.uniformFor(node.id, paramId, Number(node.params[paramId] ?? 0));
  }

  // `visiting` guards against cycles (React Flow doesn't forbid them): a node
  // seen twice on one walk compiles to the flat fallback instead of recursing
  // forever.
  const visiting = new Set<string>();

  // How many warp drivers the walk is currently inside — the depth that
  // MAX_WARP_DRIVER_DEPTH caps. Source chains stay uncounted: they emit once
  // per level, so they're linear and safe at any depth.
  let warpDriverDepth = 0;

  function compileField(node: GraphNode | null): FieldFn {
    if (node === null || visiting.has(node.id)) return () => float(0.5);
    visiting.add(node.id);

    try {
      switch (node.spec) {
        case 'gradient': {
          // Directional ramp: project the centered sample point onto the
          // angle's direction vector. At 0deg the projection spans -0.5..0.5,
          // so +0.5 lands the field exactly on 0..1; diagonal angles overshoot
          // a little and the clamp trims them.
          const angle = dial(node, 'angle').mul(DEGREES_TO_RADIANS);
          const direction = vec2(cos(angle), sin(angle));

          return (samplePoint) => clamp(dot(samplePoint.sub(0.5), direction).add(0.5), 0, 1);
        }

        case 'noise': {
          // 3D simplex sampled on an x/y window with time on z, so the
          // pattern morphs in place rather than scrolling. Raw noise spans
          // roughly -1..1; the add/mul rescales to the 0..1 fields speak.
          // Spike caveat: speed multiplies raw time, so changing it snaps the
          // pattern to a new phase — the real fix is the engine's
          // useAnimatableSpeed accumulator, deliberately not pulled in here.
          const scale = dial(node, 'scale');
          const speed = dial(node, 'speed');

          return (samplePoint) =>
            simplexNoise(vec3(samplePoint.mul(scale), elapsedTime.mul(speed)))
              .add(1)
              .mul(0.5);
        }

        case 'warp': {
          const source = compileField(upstreamOf(node.id, 'source'));
          const driverNode = upstreamOf(node.id, 'by');

          if (driverNode === null || warpDriverDepth >= MAX_WARP_DRIVER_DEPTH) return source;

          warpDriverDepth += 1;
          const driver = compileField(driverNode);

          warpDriverDepth -= 1;
          const amount = dial(node, 'amount');

          return (samplePoint) => {
            // Two taps of the scalar driver, far apart, become the x and y of
            // a push vector; recentering (-0.5) lets the push point any
            // direction instead of only down-right.
            const pushX = driver(samplePoint).sub(0.5);
            const pushY = driver(displace(samplePoint, vec2(...DRIVER_DECORRELATE))).sub(0.5);
            const push = vec2(pushX, pushY).mul(amount);

            return source(displace(samplePoint, push));
          };
        }

        case 'curve': {
          // Photoshop-curves in one dial: raise the field to a power. bend 0
          // is identity (2^0 = 1); positive bend brightens midtones (exponent
          // shrinks toward 0.25), negative darkens (toward 4). Exponents stay
          // positive, so pow never sees the negative-base trap.
          const input = compileField(upstreamOf(node.id, 'in'));
          const exponent = exp2(dial(node, 'bend').mul(-2));

          return (samplePoint) => pow(clamp(input(samplePoint), 0, 1), exponent);
        }

        case 'blend': {
          const base = compileField(upstreamOf(node.id, 'in'));
          const overlayNode = upstreamOf(node.id, 'with');

          if (overlayNode === null) return base;

          const overlay = compileField(overlayNode);
          const amount = dial(node, 'amount');
          const mode = String(node.params.mode ?? 'mix');

          return (samplePoint) => {
            const a = base(samplePoint);
            const b = overlay(samplePoint);

            // Each mode computes the fully-blended value, then `amount` fades
            // between untouched base and that result — same shape as layer
            // opacity in an image editor. Screen is multiply on the inverted
            // fields, inverted back: it can only brighten, as in Photoshop.
            let blended = b;

            if (mode === 'multiply') blended = a.mul(b);
            if (mode === 'screen') blended = a.oneMinus().mul(b.oneMinus()).oneMinus();

            return mix(a, blended, amount);
          };
        }

        // Field-only compile of color-typed nodes never happens with typed
        // ports, but the exhaustive switch keeps TypeScript honest.
        case 'colorRamp':
        case 'tone':
        case 'output':
          return () => float(0.5);
      }
    } finally {
      visiting.delete(node.id);
    }
  }

  // Color nodes chain too (Color Ramp -> Tone -> ... -> Output), so this walk
  // recurses like compileField and shares the same cycle guard.
  function compileColor(node: GraphNode | null): TSLNode {
    if (node === null || visiting.has(node.id)) return vec3(0.09, 0.09, 0.12);
    visiting.add(node.id);

    try {
      switch (node.spec) {
        case 'colorRamp': {
          const input = compileField(upstreamOf(node.id, 'in'));
          // parseColorString decodes hex to linear-sRGB floats; vec3 lifts the
          // CPU triple into a TSL constant the ramp can mix on the GPU.
          const stops = RAMP_HEX.map((hex, index) => ({
            position: index / (RAMP_HEX.length - 1),
            color: vec3(...parseColorString(hex)),
          }));

          return colorRamp(input(uv()), stops, 'oklab');
        }

        case 'tone': {
          // Curve's one-dial pow, applied to the finished image: per-channel
          // in linear RGB, so positive bend lifts the image toward the
          // palette's light end, negative sinks it. Probe-grade fidelity — a
          // shipped Tone would bend OKLab lightness instead, holding hue and
          // saturation steady while the tones move.
          const input = compileColor(upstreamOf(node.id, 'in'));
          const exponent = exp2(dial(node, 'bend').mul(-2));

          return pow(clamp(input, 0, 1), exponent);
        }

        case 'gradient':
        case 'noise':
        case 'warp':
        case 'curve':
        case 'blend':
        case 'output':
          return vec3(0.09, 0.09, 0.12);
      }
    } finally {
      visiting.delete(node.id);
    }
  }

  const outputNode = nodesById.get(outputId);

  if (!outputNode) return vec3(0.09, 0.09, 0.12);

  return compileColor(upstreamOf(outputNode.id, 'in'));
}

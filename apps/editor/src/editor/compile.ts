// The graph-to-TSL compiler: walks the card graph from an Output node
// backward and assembles a TSL color expression from Matter's Tier 2
// primitives. The core representation: a compiled field is a FUNCTION of the
// sample position, `(p) => value`, not a value — that's what lets Warp work,
// because warping IS calling the upstream field at a shifted position. Slider
// params ride per-node uniforms from the ParamStore (drags glide, no
// rebuild); select params (Blend's mode, Fractal Noise's style) bake into the
// shader and rebuild on change; Color Ramp's stop positions/colors ride
// uniforms too (MAT-86), so only its stop COUNT is structural.
import {
  colorRamp,
  colorSpaces,
  displace,
  fractalNoise,
  grain,
  metaballs,
  simplexNoise,
  voronoiCells,
} from '@lovo/matter';
import { parseColorString } from '@lovo/matter/color';
import {
  add,
  clamp,
  cos,
  dot,
  exp2,
  float,
  length,
  max,
  mix,
  pow,
  screenSize,
  sin,
  smoothstep,
  sub,
  uv,
  vec2,
  vec3,
} from 'three/tsl';
import type { ShaderNodeObject } from 'three/tsl';
import type { Node } from 'three/webgpu';

import { rampStopsOf } from './graph';
import type { GraphEdge, GraphNode } from './graph';
import type { ParamStore } from './param-store';
import {
  BLOBS_THRESHOLD,
  DRIVER_DECORRELATE,
  FRACTAL_OCTAVES,
  FRACTAL_STYLE_FOLD,
  FRACTAL_STYLE_REMAP,
  MAX_WARP_DRIVER_DEPTH,
  VORONOI_DRIFT,
  VORONOI_EDGE_GAIN,
} from './registry';

type TSLNode = ShaderNodeObject<Node>;

/** A field: grayscale value (0..1) as a function of sample position (vec2). */
type FieldFn = (samplePoint: TSLNode) => TSLNode;

// Fixed character constants (DRIVER_DECORRELATE, fractal/voronoi/blobs
// tuning) and the warp depth cap live in registry.ts so the code emitter
// shares them without importing three.

const DEGREES_TO_RADIANS = Math.PI / 180;

/** Fractal Noise's style select, narrowed with a runtime check instead of a
    cast — the param's declared type also covers ramp arrays (a node's params
    are a shared `ParamValue` bag), so a bare `as` would silently trust a
    shape that was never validated. Anything unrecognized falls back to
    'clouds', matching the registry's default. */
function fractalStyleOf(node: GraphNode): keyof typeof FRACTAL_STYLE_FOLD {
  const value = node.params.style;

  return value === 'smoke' || value === 'veins' ? value : 'clouds';
}

/** Blend's mode select, narrowed the same way — falls back to 'mix'. */
function blendModeOf(node: GraphNode): string {
  const value = node.params.mode;

  return typeof value === 'string' ? value : 'mix';
}

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

  /** The node's animation clock: a per-node phase uniform the ParamStore
      integrates on the CPU (phase += speed x delta each tick), so dragging
      the speed dial changes the RATE, never the position. */
  function dialPhase(node: GraphNode) {
    return params.phaseFor(node.id, dial(node, 'speed'));
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
          // 3D simplex sampled on an x/y window with phase on z, so the
          // pattern morphs in place rather than scrolling. Raw noise spans
          // roughly -1..1; the add/mul rescales to the 0..1 fields speak.
          const scale = dial(node, 'scale');
          const phase = dialPhase(node);

          return (samplePoint) =>
            simplexNoise(vec3(samplePoint.mul(scale), phase))
              .add(1)
              .mul(0.5);
        }

        case 'fractalNoise': {
          const scale = dial(node, 'scale');
          const phase = dialPhase(node);
          const style = fractalStyleOf(node);
          const { stretch, lift } = FRACTAL_STYLE_REMAP[style];

          // fBm sums FRACTAL_OCTAVES layers of simplex, each double the
          // frequency and (by default) half the amplitude of the last. The
          // style select picks the turbulence fold (abs-based creasing) and
          // its 0..1 remap — folded sums pool off-center, so each style
          // stretches/lifts back onto the range the ramp expects. Selects
          // bake: changing style rebuilds the material.
          return (samplePoint) =>
            clamp(
              fractalNoise(vec3(samplePoint.mul(scale), phase), {
                octaves: FRACTAL_OCTAVES,
                fold: FRACTAL_STYLE_FOLD[style],
              })
                .mul(stretch)
                .add(lift),
              0,
              1,
            );
        }

        case 'voronoi': {
          const scale = dial(node, 'scale');
          const phase = dialPhase(node);

          // Edge-distance field: 0 exactly on a cell border, rising toward
          // cell interiors. VORONOI_DRIFT gives the seeds an orbit for the
          // speed dial to animate (drift 0 would freeze the pattern
          // regardless of speed).
          return (samplePoint) =>
            clamp(
              voronoiCells(samplePoint.mul(scale), {
                time: phase,
                drift: VORONOI_DRIFT,
              }).edgeDistance.mul(VORONOI_EDGE_GAIN),
              0,
              1,
            );
        }

        case 'blobs': {
          const count = dial(node, 'count');
          const size = dial(node, 'size');
          const phase = dialPhase(node);

          // metaballs wants centered pattern space (blobs roam around the
          // origin). The summed field rises past 1 inside overlaps; the
          // smoothstep window turns it into a soft goo silhouette.
          return (samplePoint) =>
            smoothstep(
              float(BLOBS_THRESHOLD[0]),
              float(BLOBS_THRESHOLD[1]),
              metaballs(samplePoint.sub(0.5), { count, size, time: phase }).field,
            );
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
          const mode = blendModeOf(node);

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
        case 'levels':
        case 'vignette':
        case 'grain':
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

          // Node-driven stops: positions and colors are uniforms, so
          // ColorInput and position drags re-mix on the GPU with no rebuild.
          // Stop COUNT is the one structural bit (the mix chain's arity) —
          // adding/removing a stop rebuilds.
          const stops = rampStopsOf(node).map((stop, index) => ({
            position: params.stopPositionFor(node.id, index, stop.position),
            color: params.stopColorFor(node.id, index, parseColorString(stop.color)),
          }));

          return colorRamp(input(uv()), stops, 'oklab');
        }

        case 'tone': {
          // The probe bent raw RGB; shipped Tone bends OKLab LIGHTNESS,
          // holding hue and chroma steady while the tones move — the
          // Photoshop tone-curve model.
          const input = compileColor(upstreamOf(node.id, 'in'));
          const bend = dial(node, 'bend');
          const lab = colorSpaces.oklab.fromLinear(vec3(input));
          const bentLightness = pow(clamp(lab.x, 0, 1), exp2(bend.mul(-2)));

          return colorSpaces.oklab.toLinear(vec3(bentLightness, lab.y, lab.z));
        }

        case 'levels': {
          // Photoshop Levels on OKLab lightness: black/white points
          // renormalize the range, gamma bends the mids (exponent 1/gamma,
          // so gamma > 1 brightens). The max() keeps the divide finite if the
          // two sliders meet.
          const input = compileColor(upstreamOf(node.id, 'in'));
          const black = dial(node, 'black');
          const white = dial(node, 'white');
          const gamma = dial(node, 'gamma');
          const lab = colorSpaces.oklab.fromLinear(vec3(input));
          const span = max(sub(white, black), 1e-4);
          const leveled = pow(clamp(lab.x.sub(black).div(span), 0, 1), float(1).div(gamma));

          return colorSpaces.oklab.toLinear(vec3(leveled, lab.y, lab.z));
        }

        case 'vignette': {
          // Darken toward the edges: distance from center (aspect-corrected
          // via screenSize so the falloff stays circular), a smoothstep ramp
          // from the clear coverage radius outward over the softness width,
          // multiplied in.
          const input = compileColor(upstreamOf(node.id, 'in'));
          const coverage = dial(node, 'coverage');
          const softness = dial(node, 'softness');
          const centered = uv().sub(0.5);
          const aspect = screenSize.x.div(screenSize.y);
          const distance = length(vec2(centered.x.mul(aspect), centered.y));
          const darkening = smoothstep(coverage, coverage.add(max(softness, 1e-3)), distance);

          return vec3(input).mul(darkening.oneMinus());
        }

        case 'grain': {
          // Monochrome film grain over the finished image: a per-pixel hash
          // centered on zero, added to all three channels. Static
          // (timeOffset 0) in v1.
          const input = compileColor(upstreamOf(node.id, 'in'));
          const amount = dial(node, 'amount');

          return add(vec3(input), vec3(grain(amount)));
        }

        case 'gradient':
        case 'noise':
        case 'fractalNoise':
        case 'voronoi':
        case 'blobs':
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

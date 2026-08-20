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
  mixColor,
  simplexNoise,
  voronoiCells,
} from '@mattermix/shaders';
import { parseColorString } from '@mattermix/shaders/color';
import {
  add,
  clamp,
  cos,
  dot,
  exp2,
  float,
  floor,
  fract,
  fwidth,
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

import { colorParamOf, rampStopsOf } from './graph';
import type { GraphEdge, GraphNode } from './graph';
import type { ParamStore } from './param-store';
import {
  BLOBS_EDGE,
  DRIVER_DECORRELATE,
  FRACTAL_GAIN_RANGE,
  FRACTAL_OCTAVES,
  FRACTAL_STYLE_FOLD,
  FRACTAL_STYLE_REMAP,
  MAX_WARP_DRIVER_DEPTH,
  NODE_SPECS,
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

/** Grain's blend select, narrowed the same way — falls back to 'additive'. */
function grainBlendOf(node: GraphNode): string {
  const value = node.params.blend;

  return value === 'subtractive' ? value : 'additive';
}

/**
 * What `dial()` actually returns: the uniform-node wrapper. Named because
 * it is NOT assignable to the plain-Node ShaderNodeObject (the variance
 * quirk noted on `dial` itself), so helpers taking dials must ask for this
 * type rather than TSLNode.
 */
type DialNode = ReturnType<ParamStore['uniformFor']>;

/**
 * The docs noise components' shared shaping pair, applied to a 0..1 field.
 * Balance first: (balance - 0.5) * 2 turns the 0..1 dial into a -1..+1 shift,
 * so either end can push every value past a field extreme; the clamp catches
 * overshoot. Then contrast: a subtract/scale/add-back sandwich stretches
 * distances from the midpoint while the midpoint stays fixed — 1 is identity,
 * above 1 pushes toward the extremes, below 1 pulls toward the middle.
 */
function shapeField(value: TSLNode, balance: DialNode, contrast: DialNode): TSLNode {
  const balanced = clamp(value.add(balance.sub(0.5).mul(2)), 0, 1);

  return clamp(balanced.sub(0.5).mul(contrast).add(0.5), 0, 1);
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
          const repeat = dial(node, 'repeat');
          const speed = dial(node, 'speed');
          const phase = dialPhase(node);

          return (samplePoint) => {
            const coord = dot(samplePoint.sub(0.5), direction).add(0.5);

            // Animated single-pass form: (1 - cos(π·x)) / 2 ping-pongs the
            // ramp with period 2, C∞ smooth so the turnaround never bands.
            // The smoothstep(0, 0.01, speed) mix is a GPU gate: at speed 0 it
            // returns the static clamped coordinate bit for bit, so the
            // default stays identical to the pre-MAT-99 card.
            const cosineAnimated = sub(1, cos(coord.add(phase).mul(Math.PI))).mul(0.5);
            const animated = mix(clamp(coord, 0, 1), cosineAnimated, smoothstep(0, 0.01, speed));

            // Tiled form (the conveyor): repeat squeezes that many ramp
            // passes into one, fract() saws the coordinate 0 -> 1, and
            // subtracting the phase marches the stripes along the angle.
            // Same gate trick at repeat 1 — mirrors the docs LinearGradient.
            const tiled = fract(coord.mul(repeat).sub(phase));

            return mix(animated, tiled, smoothstep(1, 1.01, repeat));
          };
        }

        case 'noise': {
          // 3D simplex sampled on an x/y window with phase on z, so the
          // pattern morphs in place rather than scrolling. Raw noise spans
          // roughly -1..1; the add/mul rescales to the 0..1 fields speak,
          // then the shared balance/contrast pair shapes the result.
          const scale = dial(node, 'scale');
          const contrast = dial(node, 'contrast');
          const balance = dial(node, 'balance');
          const phase = dialPhase(node);

          return (samplePoint) =>
            shapeField(
              simplexNoise(vec3(samplePoint.mul(scale), phase))
                .add(1)
                .mul(0.5),
              balance,
              contrast,
            );
        }

        case 'fractalNoise': {
          const scale = dial(node, 'scale');
          const detail = dial(node, 'detail');
          const contrast = dial(node, 'contrast');
          const balance = dial(node, 'balance');
          const phase = dialPhase(node);
          const style = fractalStyleOf(node);
          const { stretch, lift } = FRACTAL_STYLE_REMAP[style];

          // The detail dial rides a uniform remapped onto the useful gain
          // range on the GPU, so it glides: gain is the per-octave amplitude
          // falloff, deciding how loudly the finer octaves speak over the
          // broad base layer.
          const gain = mix(float(FRACTAL_GAIN_RANGE.min), float(FRACTAL_GAIN_RANGE.max), detail);

          // fBm sums FRACTAL_OCTAVES layers of simplex, each double the
          // frequency and pow(gain, i) times the amplitude of the last. The
          // style select picks the turbulence fold (abs-based creasing) and
          // its 0..1 remap — folded sums pool off-center, so each style
          // stretches/lifts back onto the range the ramp expects. Selects
          // bake: changing style rebuilds the material. Balance/contrast
          // shape the remapped value, same chain as the Noise card.
          return (samplePoint) =>
            shapeField(
              clamp(
                fractalNoise(vec3(samplePoint.mul(scale), phase), {
                  octaves: FRACTAL_OCTAVES,
                  gain,
                  fold: FRACTAL_STYLE_FOLD[style],
                })
                  .mul(stretch)
                  .add(lift),
                0,
                1,
              ),
              balance,
              contrast,
            );
        }

        case 'voronoi': {
          const scale = dial(node, 'scale');
          const shading = dial(node, 'shading');
          const irregularity = dial(node, 'irregularity');
          const drift = dial(node, 'drift');
          const phase = dialPhase(node);

          // The cells hand back two fields and the shading dial blends
          // between them: edgeDistance (0 exactly on a cell border, rising
          // toward interiors — scaled onto 0..1 by the gain) at shading 1,
          // and the per-cell random hash (a flat mosaic, every pixel in a
          // cell sharing one value) at shading 0. irregularity is the
          // primitive's seed jitter — 0 snaps seeds to a square grid — and
          // drift is the seed orbit radius the speed dial animates (0
          // freezes the pattern regardless of speed; it was a fixed 0.6
          // before MAT-99 exposed it).
          return (samplePoint) => {
            const cells = voronoiCells(samplePoint.mul(scale), {
              time: phase,
              jitter: irregularity,
              drift,
            });
            const borderDepth = clamp(cells.edgeDistance.mul(VORONOI_EDGE_GAIN), 0, 1);

            return mix(cells.hash, borderDepth, shading);
          };
        }

        case 'blobs': {
          const count = dial(node, 'count');
          const size = dial(node, 'size');
          const sizeVariation = dial(node, 'sizeVariation');
          const spread = dial(node, 'spread');
          const softness = dial(node, 'softness');
          const center = vec2(dial(node, 'center.x'), dial(node, 'center.y'));
          const phase = dialPhase(node);

          // metaballs wants centered pattern space — subtracting `center`
          // puts the roam origin wherever the dial points (0.5/0.5 is the
          // canvas center). The summed field rises past 1 inside overlaps;
          // the goo edge is where it crosses the threshold, feathered by
          // softness (mirroring the docs Blobs): fwidth() — how much the
          // field changes across one screen pixel — keeps the edge
          // anti-aliased even at softness 0, and the dial widens the band
          // from there up to MAX_SOFTNESS field units.
          return (samplePoint) => {
            const field = metaballs(samplePoint.sub(center), {
              count,
              size,
              sizeVariation,
              spread,
              time: phase,
            }).field;
            const band = fwidth(field).add(softness.mul(BLOBS_EDGE.maxSoftness));

            return smoothstep(
              float(BLOBS_EDGE.threshold).sub(band),
              float(BLOBS_EDGE.threshold).add(band),
              field,
            );
          };
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
          // Blend toward `color` as pixels get further from `center`
          // (aspect-corrected via screenSize so the falloff stays circular):
          // a smoothstep ramp from the clear coverage radius outward over the
          // softness width, scaled by strength, mixed in oklab like the docs
          // Vignette. At the defaults (strength 1, black, centered) the mask
          // is the pre-MAT-99 darkening — only the mixing space moved from
          // linear to oklab.
          const input = compileColor(upstreamOf(node.id, 'in'));
          const strength = dial(node, 'strength');
          const coverage = dial(node, 'coverage');
          const softness = dial(node, 'softness');
          // The center rides two scalar uniforms (an xy param's storage
          // form); vec2() assembles them fresh per expression, which is also
          // the safe TSL shape — vec uniforms misbehave as chained receivers.
          const center = vec2(dial(node, 'center.x'), dial(node, 'center.y'));
          const tint = params.colorFor(
            node.id,
            'color',
            parseColorString(colorParamOf(node, 'color')),
          );
          const centered = uv().sub(center);
          const aspect = screenSize.x.div(screenSize.y);
          const distance = length(vec2(centered.x.mul(aspect), centered.y));
          const mask = smoothstep(coverage, coverage.add(max(softness, 1e-3)), distance);

          return mixColor(vec3(input), tint, mask.mul(strength), 'oklab');
        }

        case 'grain': {
          // Monochrome film grain over the finished image: a per-pixel hash
          // centered on zero on all three channels. floor(phase * 60)
          // quantizes the animation into whole ticks, so the pattern
          // re-rolls discretely — at speed 0 the phase never advances and
          // the grain freezes (the v1 behavior). The blend select bakes:
          // additive nudges pixels both ways (sparkle), subtractive folds
          // the noise positive and only darkens (dark specks).
          const input = compileColor(upstreamOf(node.id, 'in'));
          const amount = dial(node, 'amount');
          const phase = dialPhase(node);
          const grainValue = grain(amount, floor(phase.mul(60)));

          if (grainBlendOf(node) === 'subtractive') {
            return sub(vec3(input), vec3(grainValue.abs()));
          }

          return add(vec3(input), vec3(grainValue));
        }

        case 'gradient':
        case 'noise':
        case 'fractalNoise':
        case 'voronoi':
        case 'blobs':
        case 'warp':
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

  const upstreamNode = upstreamOf(outputNode.id, 'in');

  // Output-only exception (see portsCompatible in registry.ts): a bare field
  // wired straight into Output is allowed, and renders as its grayscale
  // image rather than being rejected at connect time. Promoting it is just
  // `vec3(scalar)` — TSL broadcasts a scalar across all three channels — and
  // that promotion happens ONLY here, at the Output seam; compileColor's own
  // field-typed fallback arms below never run for a validly-typed graph.
  if (upstreamNode !== null && NODE_SPECS[upstreamNode.spec].output === 'field') {
    return vec3(compileField(upstreamNode)(uv()));
  }

  return compileColor(upstreamNode);
}

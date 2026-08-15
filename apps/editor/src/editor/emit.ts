// The editor's second backend: the same graph walk as compile.ts, but
// producing SOURCE TEXT instead of TSL nodes — the eject-to-code path. Field
// nodes emit as named arrow functions of the sample position, mirroring the
// runtime compiler's field-as-function representation, so fan-out reads as an
// ordinary shared helper and Warp reads as calling a field at a shifted
// point. Slider dials become props with the current values as defaults;
// selects and ramp stops bake as literals (they're data, not dials); speed
// dials become useAnimatableSpeed hooks — the generated component is a FIXED
// graph, so hooks are callable there, unlike the editor runtime, whose node
// count varies (see ParamStore's phase integrator).
//
// Deliberately three-free: a Node test imports this to write the generated
// file to disk. Every constant interpolated into emitted text
// (FRACTAL_STYLE_*, VORONOI_*, BLOBS_THRESHOLD, DRIVER_DECORRELATE) comes
// from registry.ts, the same source compile.ts reads, so the two backends
// can't drift apart on tuning.
import { rampStopsOf } from './graph';
import type { GraphEdge, GraphNode } from './graph';
import {
  BLOBS_THRESHOLD,
  DRIVER_DECORRELATE,
  FRACTAL_OCTAVES,
  FRACTAL_STYLE_FOLD,
  FRACTAL_STYLE_REMAP,
  MAX_WARP_DRIVER_DEPTH,
  NODE_SPECS,
  VORONOI_DRIFT,
  VORONOI_EDGE_GAIN,
} from './registry';

// ---------------------------------------------------------------------------
// Emitter state — one Emission per generated file
// ---------------------------------------------------------------------------

interface PropLine {
  name: string;
  jsdoc: string;
  defaultValue: number;
  /** Speed props stay OUT of the effect deps: their phase uniform absorbs
      changes, same reasoning as LinearGradient's speedUniform gate. */
  isSpeed: boolean;
}

class Emission {
  /** Helper declarations, upstream-first, ready to join into the effect body. */
  helperLines: string[] = [];
  /** `const xUniform = uniform(x);` lines, grouped at the top of the effect. */
  uniformLines: string[] = [];
  /** Hook calls (useAnimatableSpeed), placed inside the component BEFORE the
      effect — hooks can't live inside useEffect. */
  hookLines: string[] = [];
  props: PropLine[] = [];
  /** Named imports actually used, per module, so the file imports stay clean. */
  matterImports = new Set<string>();
  matterReactImports = new Set<string>(['useShaderContext']);
  tslImports = new Set<string>();
  usesParseColor = false;
  usesColorSpaces = false;

  private takenNames = new Set<string>();

  /** Returns `base`, or `base2`, `base3`... when a name is already claimed. */
  claim(base: string): string {
    let candidate = base;
    let counter = 2;

    while (this.takenNames.has(candidate)) {
      candidate = `${base}${counter}`;
      counter += 1;
    }
    this.takenNames.add(candidate);

    return candidate;
  }
}

/** Fractal Noise's style select, narrowed with a runtime check instead of a
    cast — same guard as compile.ts, same 'clouds' fallback. */
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
// The walk — mirrors compile.ts case for case
// ---------------------------------------------------------------------------

/**
 * Emits a complete, drop-in component file for the subgraph feeding
 * `outputId`. The result is a bare Matter component (mount inside a
 * ShaderScene); unwired inputs fall back exactly like the runtime compiler,
 * so the generated file renders the same image as the Output card.
 */
export function emitComponentSource(
  nodes: GraphNode[],
  edges: GraphEdge[],
  outputId: string,
): string {
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const emission = new Emission();

  function upstreamOf(nodeId: string, handleId: string): GraphNode | null {
    const edge = edges.find(
      (candidate) => candidate.target === nodeId && candidate.targetHandle === handleId,
    );

    return edge ? (nodesById.get(edge.source) ?? null) : null;
  }

  // A slider param becomes a prop (default = the editor's current value) plus
  // a uniform riding it. Returns the uniform's variable name for expressions.
  // Deduped per node dial: a depth-forked helper (see fieldKeyOf below)
  // re-emits its node, and every variant must ride the same prop and uniform —
  // one editor dial, one prop.
  const dialNames = new Map<string, string>();

  function claimDialProp(node: GraphNode, baseName: string, paramId: string): string {
    const spec = NODE_SPECS[node.spec];
    const param = spec.params.find((candidate) => candidate.id === paramId);
    const value = Number(node.params[paramId] ?? 0);
    const propName = emission.claim(
      `${baseName}${paramId.charAt(0).toUpperCase()}${paramId.slice(1)}`,
    );

    const range = param?.kind === 'slider' ? `, ${param.min} to ${param.max}` : '';

    emission.props.push({
      name: propName,
      jsdoc: `${spec.name} ${paramId}${range}. Defaults to ${value}.`,
      defaultValue: value,
      isSpeed: paramId === 'speed',
    });

    return propName;
  }

  function emitDial(node: GraphNode, baseName: string, paramId: string): string {
    const dialKey = `${node.id}/${paramId}`;
    const emitted = dialNames.get(dialKey);

    if (emitted !== undefined) return emitted;

    const propName = claimDialProp(node, baseName, paramId);

    emission.tslImports.add('uniform');
    emission.uniformLines.push(`const ${propName}Uniform = uniform(${propName});`);
    dialNames.set(dialKey, `${propName}Uniform`);

    return `${propName}Uniform`;
  }

  // A speed dial's expression sites read the PHASE, not the speed: the
  // useAnimatableSpeed hook integrates speed into a phase uniform on the CPU
  // (mirroring what the editor's ParamStore does per node), so dragging speed
  // changes the rate, never the position. One hook per speed dial.
  function emitSpeedDial(node: GraphNode, baseName: string): string {
    const dialKey = `${node.id}/speed`;
    const emitted = dialNames.get(dialKey);

    if (emitted !== undefined) return emitted;

    const propName = claimDialProp(node, baseName, 'speed');

    emission.matterReactImports.add('useAnimatableSpeed');
    emission.hookLines.push(`const ${propName}Phase = useAnimatableSpeed(${propName});`);
    dialNames.set(dialKey, `${propName}Phase`);

    return `${propName}Phase`;
  }

  // Shared fallback helper, declared at most once.
  let flatFieldName: string | null = null;

  function flatField(): string {
    if (flatFieldName === null) {
      flatFieldName = emission.claim('flatField');
      emission.tslImports.add('float');
      emission.helperLines.push(
        `// Unwired inputs read as flat mid-gray, matching the editor.`,
        `const ${flatFieldName} = (_p: TSLNode) => float(0.5);`,
        '',
      );
    }

    return flatFieldName;
  }

  const EMPTY_COLOR = 'vec3(0.09, 0.09, 0.12)';

  // Emitted field helpers, keyed by fieldKeyOf — node id alone for
  // depth-insensitive subtrees, id plus entry depth when the warp cap can bite.
  const fieldNames = new Map<string, string>();
  const colorNames = new Map<string, string>();
  const visiting = new Set<string>();

  // How many warp drivers the walk is currently inside — the depth that
  // MAX_WARP_DRIVER_DEPTH caps, mirroring the runtime compiler. Source
  // chains stay uncounted: they emit once per level, so they're linear and
  // safe at any depth.
  let warpDriverDepth = 0;

  // Whether a field subtree's emission depends on warpDriverDepth: true when
  // a warp with a wired driver sits anywhere inside it, because the depth cap
  // is read where the REFERENCE sits, not where the node is defined. Purely
  // structural, and editor graphs are small, so no memoization.
  function dependsOnDriverDepth(node: GraphNode | null, seen = new Set<string>()): boolean {
    if (node === null || seen.has(node.id)) return false;
    seen.add(node.id);

    switch (node.spec) {
      case 'warp':
        return (
          upstreamOf(node.id, 'by') !== null ||
          dependsOnDriverDepth(upstreamOf(node.id, 'source'), seen)
        );
      case 'blend':
        return (
          dependsOnDriverDepth(upstreamOf(node.id, 'in'), seen) ||
          dependsOnDriverDepth(upstreamOf(node.id, 'with'), seen)
        );
      default:
        return false;
    }
  }

  // Cache key for a field helper. Depth-insensitive subtrees share one helper
  // across every reference (the common fan-out); depth-sensitive ones fork per
  // entry depth, so a real warp cached below the cap is never reused where the
  // cap applies, and a capped pass-through never shadows a shallow reference
  // that must emit the real warp. Depths at or past the cap all emit
  // identically — every driver inside caps — so they collapse onto one key.
  function fieldKeyOf(node: GraphNode): string {
    if (!dependsOnDriverDepth(node)) return node.id;

    return `${node.id}@${Math.min(warpDriverDepth, MAX_WARP_DRIVER_DEPTH)}`;
  }

  /**
   * Emits one of the five GENERATE cards — the leaf fields, no upstream
   * recursion. Split from emitField so each walk function stays under the
   * lint complexity bar; the caller owns caching and the cycle guard.
   */
  function emitGeneratorField(node: GraphNode): string {
    switch (node.spec) {
      case 'gradient': {
        const base = emission.claim('gradient');
        const name = `${base}Field`;
        const angle = emitDial(node, base, 'angle');

        for (const used of ['clamp', 'dot', 'vec2', 'cos', 'sin']) emission.tslImports.add(used);
        emission.helperLines.push(
          `// Directional ramp: project the centered point onto the angle's direction.`,
          `const ${base}Radians = ${angle}.mul(Math.PI / 180);`,
          `const ${base}Direction = vec2(cos(${base}Radians), sin(${base}Radians));`,
          `const ${name} = (p: TSLNode) => clamp(dot(p.sub(0.5), ${base}Direction).add(0.5), 0, 1);`,
          '',
        );

        return name;
      }

      case 'noise': {
        const base = emission.claim('noise');
        const name = `${base}Field`;
        const scale = emitDial(node, base, 'scale');
        const phase = emitSpeedDial(node, base);

        emission.matterImports.add('simplexNoise');
        emission.tslImports.add('vec3');
        emission.helperLines.push(
          `// 3D simplex with the animation phase on z: the pattern morphs in`,
          `// place. Raw noise spans roughly -1..1; add/mul rescales to 0..1.`,
          `const ${name} = (p: TSLNode) =>`,
          `  simplexNoise(vec3(p.mul(${scale}), ${phase}))`,
          `    .add(1)`,
          `    .mul(0.5);`,
          '',
        );

        return name;
      }

      case 'fractalNoise': {
        const base = emission.claim('fractal');
        const name = `${base}Field`;
        const scale = emitDial(node, base, 'scale');
        const phase = emitSpeedDial(node, base);
        const style = fractalStyleOf(node);
        const { stretch, lift } = FRACTAL_STYLE_REMAP[style];

        emission.matterImports.add('fractalNoise');
        for (const used of ['clamp', 'vec3']) emission.tslImports.add(used);
        emission.helperLines.push(
          `// fBm: ${FRACTAL_OCTAVES} octaves of simplex, each double the frequency of the`,
          `// last. Style "${style}" baked in: fold '${FRACTAL_STYLE_FOLD[style]}', with the folded sum`,
          `// stretched/lifted back onto the 0..1 range the ramp expects.`,
          `const ${name} = (p: TSLNode) =>`,
          `  clamp(`,
          `    fractalNoise(vec3(p.mul(${scale}), ${phase}), {`,
          `      octaves: ${FRACTAL_OCTAVES},`,
          `      fold: '${FRACTAL_STYLE_FOLD[style]}',`,
          `    })`,
          `      .mul(${stretch})`,
          `      .add(${lift}),`,
          `    0,`,
          `    1,`,
          `  );`,
          '',
        );

        return name;
      }

      case 'voronoi': {
        const base = emission.claim('voronoi');
        const name = `${base}Field`;
        const scale = emitDial(node, base, 'scale');
        const phase = emitSpeedDial(node, base);

        emission.matterImports.add('voronoiCells');
        emission.tslImports.add('clamp');
        emission.helperLines.push(
          `// Edge-distance field: 0 exactly on a cell border, rising toward`,
          `// cell interiors. Drift gives the seeds an orbit for speed to animate.`,
          `const ${name} = (p: TSLNode) =>`,
          `  clamp(`,
          `    voronoiCells(p.mul(${scale}), {`,
          `      time: ${phase},`,
          `      drift: ${VORONOI_DRIFT},`,
          `    }).edgeDistance.mul(${VORONOI_EDGE_GAIN}),`,
          `    0,`,
          `    1,`,
          `  );`,
          '',
        );

        return name;
      }

      case 'blobs': {
        const base = emission.claim('blobs');
        const name = `${base}Field`;
        const count = emitDial(node, base, 'count');
        const size = emitDial(node, base, 'size');
        const phase = emitSpeedDial(node, base);

        emission.matterImports.add('metaballs');
        for (const used of ['smoothstep', 'float']) emission.tslImports.add(used);
        emission.helperLines.push(
          `// metaballs wants centered pattern space (blobs roam the origin). The`,
          `// summed field rises past 1 inside overlaps; the smoothstep window`,
          `// turns it into a soft goo silhouette.`,
          `const ${name} = (p: TSLNode) =>`,
          `  smoothstep(float(${BLOBS_THRESHOLD[0]}), float(${BLOBS_THRESHOLD[1]}), metaballs(p.sub(0.5), { count: ${count}, size: ${size}, time: ${phase} }).field);`,
          '',
        );

        return name;
      }

      default:
        // Unreachable: emitField's dispatch only routes generate specs here.
        return flatField();
    }
  }

  /**
   * The warp case: recursive, and the one place the driver-depth counter
   * moves. Split from emitField for the lint complexity bar; `fieldKey` comes
   * from the caller because the pass-through arms cache under it too.
   */
  function emitWarpField(node: GraphNode, fieldKey: string): string {
    const sourceNode = upstreamOf(node.id, 'source');
    const driverNode = upstreamOf(node.id, 'by');
    const source = emitField(sourceNode);

    // No driver: pass-through. Driver cap hit: also pass-through, same as
    // the editor — and the depth-forked fieldKey keeps a capped pass-through
    // away from shallower references, which must still emit the real warp.
    if (driverNode === null || warpDriverDepth >= MAX_WARP_DRIVER_DEPTH) {
      fieldNames.set(fieldKey, source);

      return source;
    }

    warpDriverDepth += 1;
    const driver = emitField(driverNode);

    warpDriverDepth -= 1;
    const base = emission.claim('warp');
    const name = `${base}Field`;
    const amount = emitDial(node, base, 'amount');

    emission.matterImports.add('displace');
    emission.tslImports.add('vec2');
    emission.helperLines.push(
      `// Domain warp: two far-apart taps of the driver become the x/y of a`,
      `// push vector; the source is then read at the pushed position.`,
      `const ${name} = (p: TSLNode) => {`,
      `  const pushX = ${driver}(p).sub(0.5);`,
      `  const pushY = ${driver}(displace(p, vec2(${DRIVER_DECORRELATE[0]}, ${DRIVER_DECORRELATE[1]}))).sub(0.5);`,
      '',
      `  return ${source}(displace(p, vec2(pushX, pushY).mul(${amount})));`,
      `};`,
      '',
    );
    fieldNames.set(fieldKey, name);

    return name;
  }

  /** The blend case, split out with the same contract as emitWarpField. */
  function emitBlendField(node: GraphNode, fieldKey: string): string {
    const baseNode = upstreamOf(node.id, 'in');
    const overlayNode = upstreamOf(node.id, 'with');
    const baseField = emitField(baseNode);

    if (overlayNode === null) {
      fieldNames.set(fieldKey, baseField);

      return baseField;
    }

    const overlay = emitField(overlayNode);
    const base = emission.claim('blend');
    const name = `${base}Field`;
    const amount = emitDial(node, base, 'amount');
    const mode = blendModeOf(node);

    // The select baked this branch into the shader; emit only the chosen
    // math, with the mode named in a comment.
    let blended = 'b';

    if (mode === 'multiply') blended = 'a.mul(b)';
    if (mode === 'screen') blended = 'a.oneMinus().mul(b.oneMinus()).oneMinus()';

    emission.tslImports.add('mix');
    emission.helperLines.push(
      `// Blend mode "${mode}": amount fades between the untouched base and`,
      `// the blended value, like layer opacity.`,
      `const ${name} = (p: TSLNode) => {`,
      `  const a = ${baseField}(p);`,
      `  const b = ${overlay}(p);`,
      '',
      `  return mix(a, ${blended}, ${amount});`,
      `};`,
      '',
    );
    fieldNames.set(fieldKey, name);

    return name;
  }

  /** Emits `node` as a field helper and returns the helper's name. */
  function emitField(node: GraphNode | null): string {
    if (node === null) return flatField();
    if (visiting.has(node.id)) return flatField();

    const fieldKey = fieldKeyOf(node);
    const existing = fieldNames.get(fieldKey);

    if (existing !== undefined) return existing;
    visiting.add(node.id);

    try {
      switch (node.spec) {
        case 'gradient':
        case 'noise':
        case 'fractalNoise':
        case 'voronoi':
        case 'blobs': {
          const name = emitGeneratorField(node);

          fieldNames.set(fieldKey, name);

          return name;
        }

        case 'warp':
          return emitWarpField(node, fieldKey);

        case 'blend':
          return emitBlendField(node, fieldKey);

        // Field-only emission of color-typed nodes never happens with typed
        // ports, but the exhaustive switch keeps TypeScript honest.
        case 'colorRamp':
        case 'tone':
        case 'levels':
        case 'vignette':
        case 'grain':
        case 'output':
          return flatField();
      }
    } finally {
      visiting.delete(node.id);
    }
  }

  /**
   * Emits one of the four ADJUST cards (color in, color out), given its
   * already-emitted input's name. Split from emitColor for the same lint
   * complexity bar as emitGeneratorField; the caller owns caching and the
   * cycle guard.
   */
  function emitAdjustColor(node: GraphNode, inputName: string | null): string {
    switch (node.spec) {
      case 'tone': {
        const base = emission.claim('tone');
        const name = `${base}Color`;
        const bend = emitDial(node, base, 'bend');

        emission.usesColorSpaces = true;
        for (const used of ['pow', 'clamp', 'exp2', 'vec3']) emission.tslImports.add(used);
        emission.helperLines.push(
          `// Tone bends OKLab LIGHTNESS, holding hue and chroma steady while`,
          `// the tones move — the Photoshop tone-curve model.`,
          `const ${base}Lab = colorSpaces.oklab.fromLinear(vec3(${inputName ?? EMPTY_COLOR}));`,
          `const ${base}Bent = pow(clamp(${base}Lab.x, 0, 1), exp2(${bend}.mul(-2)));`,
          `const ${name} = colorSpaces.oklab.toLinear(vec3(${base}Bent, ${base}Lab.y, ${base}Lab.z));`,
          '',
        );

        return name;
      }

      case 'levels': {
        const base = emission.claim('levels');
        const name = `${base}Color`;
        const black = emitDial(node, base, 'black');
        const white = emitDial(node, base, 'white');
        const gamma = emitDial(node, base, 'gamma');

        emission.usesColorSpaces = true;
        for (const used of ['pow', 'clamp', 'vec3', 'max', 'sub', 'float'])
          emission.tslImports.add(used);
        emission.helperLines.push(
          `// Photoshop Levels on OKLab lightness: black/white points renormalize`,
          `// the range, gamma bends the mids (exponent 1/gamma, so gamma > 1`,
          `// brightens). The max() keeps the divide finite if the sliders meet.`,
          `const ${base}Lab = colorSpaces.oklab.fromLinear(vec3(${inputName ?? EMPTY_COLOR}));`,
          `const ${base}Span = max(sub(${white}, ${black}), 1e-4);`,
          `const ${base}Leveled = pow(clamp(${base}Lab.x.sub(${black}).div(${base}Span), 0, 1), float(1).div(${gamma}));`,
          `const ${name} = colorSpaces.oklab.toLinear(vec3(${base}Leveled, ${base}Lab.y, ${base}Lab.z));`,
          '',
        );

        return name;
      }

      case 'vignette': {
        const base = emission.claim('vignette');
        const name = `${base}Color`;
        const coverage = emitDial(node, base, 'coverage');
        const softness = emitDial(node, base, 'softness');

        for (const used of ['vec2', 'vec3', 'uv', 'length', 'smoothstep', 'max', 'screenSize'])
          emission.tslImports.add(used);
        emission.helperLines.push(
          `// Darken toward the edges: distance from center (aspect-corrected via`,
          `// screenSize so the falloff stays circular), a smoothstep ramp from`,
          `// the clear coverage radius outward over the softness width.`,
          `const ${base}Centered = uv().sub(0.5);`,
          `const ${base}Aspect = screenSize.x.div(screenSize.y);`,
          `const ${base}Distance = length(vec2(${base}Centered.x.mul(${base}Aspect), ${base}Centered.y));`,
          `const ${base}Darkening = smoothstep(${coverage}, ${coverage}.add(max(${softness}, 1e-3)), ${base}Distance);`,
          `const ${name} = vec3(${inputName ?? EMPTY_COLOR}).mul(${base}Darkening.oneMinus());`,
          '',
        );

        return name;
      }

      case 'grain': {
        const base = emission.claim('grain');
        const name = `${base}Color`;
        const amount = emitDial(node, base, 'amount');

        emission.matterImports.add('grain');
        for (const used of ['add', 'vec3']) emission.tslImports.add(used);
        emission.helperLines.push(
          `// Monochrome film grain over the finished image: a per-pixel hash`,
          `// centered on zero, added to all three channels.`,
          `const ${name} = add(vec3(${inputName ?? EMPTY_COLOR}), vec3(grain(${amount})));`,
          '',
        );

        return name;
      }

      default:
        // Unreachable: emitColor's dispatch only routes adjust specs here.
        return inputName ?? EMPTY_COLOR;
    }
  }

  /** Emits `node` as a color VALUE (evaluated at uv()) and returns its name. */
  function emitColor(node: GraphNode | null): string | null {
    if (node === null || visiting.has(node.id)) return null;

    const existing = colorNames.get(node.id);

    if (existing !== undefined) return existing;
    visiting.add(node.id);

    try {
      switch (node.spec) {
        case 'colorRamp': {
          const input = emitField(upstreamOf(node.id, 'in'));
          const base = emission.claim('ramp');
          const name = `${base}Color`;

          emission.matterImports.add('colorRamp');
          emission.usesParseColor = true;
          emission.tslImports.add('vec3');
          emission.tslImports.add('uv');

          // Stops bake as literals — current editor values, positions to 4
          // decimals. Stops are data, not dials: they follow selects, not
          // sliders (no stops prop).
          const stops = rampStopsOf(node).map((stop) => {
            const position = Number(stop.position.toFixed(4));

            return `  { position: ${position}, color: vec3(...parseColorString('${stop.color}')) },`;
          });

          emission.helperLines.push(
            `// The door from pattern to color: the field picks a position along`,
            `// the ramp, mixed in oklab.`,
            `const ${base}Stops = [`,
            ...stops,
            `];`,
            `const ${name} = colorRamp(${input}(uv()), ${base}Stops, 'oklab');`,
            '',
          );
          colorNames.set(node.id, name);

          return name;
        }

        case 'tone':
        case 'levels':
        case 'vignette':
        case 'grain': {
          const inputName = emitColor(upstreamOf(node.id, 'in'));
          const name = emitAdjustColor(node, inputName);

          colorNames.set(node.id, name);

          return name;
        }

        case 'gradient':
        case 'noise':
        case 'fractalNoise':
        case 'voronoi':
        case 'blobs':
        case 'warp':
        case 'blend':
        case 'output':
          return null;
      }
    } finally {
      visiting.delete(node.id);
    }
  }

  const outputNode = nodesById.get(outputId) ?? null;
  const upstreamNode = outputNode === null ? null : upstreamOf(outputNode.id, 'in');

  // The Output-only exception (portsCompatible): a bare field wired straight
  // into Output renders as its grayscale image — vec3 broadcasts the scalar
  // across all three channels, only here at the output seam.
  let finalColor: string;

  if (upstreamNode !== null && NODE_SPECS[upstreamNode.spec].output === 'field') {
    const field = emitField(upstreamNode);

    emission.tslImports.add('vec3');
    emission.tslImports.add('uv');
    finalColor = `vec3(${field}(uv()))`;
  } else {
    const colorName = emitColor(upstreamNode);

    if (colorName === null) emission.tslImports.add('vec3');
    finalColor = colorName ?? EMPTY_COLOR;
  }

  return assembleFile(emission, finalColor);
}

// ---------------------------------------------------------------------------
// File assembly — imports, props interface, hooks, component shell
// ---------------------------------------------------------------------------

function assembleFile(emission: Emission, finalColorExpr: string): string {
  if (emission.usesColorSpaces) emission.matterImports.add('colorSpaces');

  const sortedTsl = [...emission.tslImports].sort();
  const sortedMatter = [...emission.matterImports].sort();
  const sortedMatterReact = [...emission.matterReactImports].sort();

  const propsInterface = emission.props
    .map((prop) => `  /** ${prop.jsdoc} */\n  ${prop.name}?: number;`)
    .join('\n');

  const destructured = emission.props
    .map((prop) => `${prop.name} = ${prop.defaultValue}`)
    .join(',\n  ');

  // A dial-free graph (say, ramp straight into Output) has no props at all;
  // emitting the interface and destructuring anyway would produce an empty
  // object type and a bare `{ , }` — a syntax error. Drop both instead.
  const propsBlock =
    emission.props.length > 0
      ? `export interface GeneratedShaderProps {\n${propsInterface}\n}\n\n`
      : '';
  const signature =
    emission.props.length > 0
      ? `export function GeneratedShader({\n  ${destructured},\n}: GeneratedShaderProps) {`
      : `export function GeneratedShader() {`;

  // Speed props are excluded: their useAnimatableSpeed phase uniform absorbs
  // speed changes without a rebuild — the same reasoning as LinearGradient's
  // speedUniform gate exception. Every other slider prop rebuilds.
  const effectDeps = [
    'shaderContext',
    ...emission.props.filter((prop) => !prop.isSpeed).map((prop) => prop.name),
  ].join(', ');

  const hookBlock =
    emission.hookLines.length > 0
      ? `\n  // Speed dials integrate on the CPU: each hook advances a phase uniform\n  // (phase += speed x delta), so speed changes retime the pattern without\n  // snapping or rebuilding — which is also why speed props stay out of the\n  // effect deps below.\n${emission.hookLines.map((line) => `  ${line}`).join('\n')}\n`
      : '';

  const indent = (line: string) => (line === '' ? '' : `    ${line}`);
  const uniformBlock = emission.uniformLines.map(indent).join('\n');
  const helperBlock = emission.helperLines.map(indent).join('\n');

  const matterImportLine =
    sortedMatter.length > 0 ? `import { ${sortedMatter.join(', ')} } from '@lovo/matter';\n` : '';
  const parseColorLine = emission.usesParseColor
    ? `import { parseColorString } from '@lovo/matter/color';\n`
    : '';

  return `'use client';

// Generated by the Matter editor. A bare Matter component: mount it inside a
// ShaderScene. Fields are functions of the sample position — warping is
// calling a field at a shifted point — and every editor dial arrived below
// as a prop with the editor's value as its default.
import { useEffect } from 'react';

${matterImportLine}import { ${sortedMatterReact.join(', ')} } from '@lovo/matter-react';
${parseColorLine}import { ${sortedTsl.join(', ')} } from 'three/tsl';
import type { ShaderNodeObject } from 'three/tsl';
import { Mesh, MeshBasicNodeMaterial, PlaneGeometry } from 'three/webgpu';
import type { Node } from 'three/webgpu';

type TSLNode = ShaderNodeObject<Node>;

${propsBlock}${signature}
  const shaderContext = useShaderContext();
${hookBlock}
  useEffect(() => {
    if (!shaderContext) return;

    // Dials ride uniforms. This generated component rebuilds its material on
    // prop change (the deps below), which is generated-code shorthand — the
    // registry pattern pushes new values through stable uniforms instead.
${uniformBlock}

${helperBlock}
    const material = new MeshBasicNodeMaterial();

    material.colorNode = ${finalColorExpr};

    const mesh = new Mesh(new PlaneGeometry(2, 2), material);

    shaderContext.scene.add(mesh);
    shaderContext.scheduler.requestRender();

    return () => {
      shaderContext.scene.remove(mesh);
      try {
        material.dispose();
      } catch {
        // three/webgpu can throw during dispose under Strict Mode double-invoke
      }
      try {
        mesh.geometry.dispose();
      } catch {
        // same
      }
    };
  }, [${effectDeps}]);

  return null;
}
`;
}

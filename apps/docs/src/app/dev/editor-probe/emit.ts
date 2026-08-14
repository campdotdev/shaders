// The editor's second backend: the same graph walk as compile.ts, but
// producing SOURCE TEXT instead of TSL nodes — this is the eject-to-code path
// (MAT-96). Field nodes emit as named arrow functions of the sample position,
// mirroring the runtime compiler's field-as-function representation, so
// fan-out reads as an ordinary shared helper and Warp reads as calling a
// field at a shifted point. Editor dials become props with the current values
// as defaults. Deliberately three-free: a Node test imports this to write the
// generated file to disk.
import type { GraphEdge, GraphNode } from './compile';
import { DRIVER_DECORRELATE, MAX_WARP_DRIVER_DEPTH, NODE_SPECS, RAMP_HEX } from './registry';

// ---------------------------------------------------------------------------
// Emitter state — one Emission per generated file
// ---------------------------------------------------------------------------

interface PropLine {
  name: string;
  jsdoc: string;
  defaultValue: number;
}

class Emission {
  /** Helper declarations, upstream-first, ready to join into the effect body. */
  helperLines: string[] = [];
  /** `const xUniform = uniform(x);` lines, grouped at the top of the effect. */
  uniformLines: string[] = [];
  props: PropLine[] = [];
  /** Named imports actually used, per module, so the file imports stay clean. */
  matterImports = new Set<string>();
  tslImports = new Set<string>();
  usesParseColor = false;

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
  function emitDial(node: GraphNode, baseName: string, paramId: string): string {
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
    });
    emission.tslImports.add('uniform');
    emission.uniformLines.push(`const ${propName}Uniform = uniform(${propName});`);

    return `${propName}Uniform`;
  }

  // Shared fallback helpers, declared at most once each.
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

  const fieldNames = new Map<string, string>();
  const colorNames = new Map<string, string>();
  const visiting = new Set<string>();

  // How many warp drivers the walk is currently inside — the depth that
  // MAX_WARP_DRIVER_DEPTH caps, mirroring the runtime compiler. Source
  // chains stay uncounted: they evaluate once per level, so they're linear
  // and safe at any depth.
  let warpDriverDepth = 0;

  /** Emits `node` as a field helper and returns the helper's name. */
  function emitField(node: GraphNode | null): string {
    if (node === null) return flatField();
    if (visiting.has(node.id)) return flatField();

    const existing = fieldNames.get(node.id);

    if (existing !== undefined) return existing;
    visiting.add(node.id);

    try {
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
          fieldNames.set(node.id, name);

          return name;
        }

        case 'noise': {
          const base = emission.claim('noise');
          const name = `${base}Field`;
          const scale = emitDial(node, base, 'scale');
          const speed = emitDial(node, base, 'speed');

          emission.matterImports.add('simplexNoise');
          emission.matterImports.add('elapsedTime');
          emission.tslImports.add('vec3');
          emission.helperLines.push(
            `// 3D simplex with time on z: the pattern morphs in place. Raw noise`,
            `// spans roughly -1..1; the add/mul rescales it to 0..1.`,
            `const ${name} = (p: TSLNode) =>`,
            `  simplexNoise(vec3(p.mul(${scale}), elapsedTime.mul(${speed})))`,
            `    .add(1)`,
            `    .mul(0.5);`,
            '',
          );
          fieldNames.set(node.id, name);

          return name;
        }

        case 'warp': {
          const sourceNode = upstreamOf(node.id, 'source');
          const driverNode = upstreamOf(node.id, 'by');
          const source = emitField(sourceNode);

          if (driverNode === null) {
            // No driver: the warp is a pass-through, same as the editor.
            fieldNames.set(node.id, source);

            return source;
          }

          if (warpDriverDepth >= MAX_WARP_DRIVER_DEPTH) {
            // Driver cap hit: pass through, same as the editor. Uncached —
            // whether the cap applies depends on where the reference sits,
            // so a shallower reference must still emit the real warp.
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
          fieldNames.set(node.id, name);

          return name;
        }

        case 'curve': {
          const input = emitField(upstreamOf(node.id, 'in'));
          const base = emission.claim('curve');
          const name = `${base}Field`;
          const bend = emitDial(node, base, 'bend');

          for (const used of ['pow', 'clamp', 'exp2']) emission.tslImports.add(used);
          emission.helperLines.push(
            `// One-dial tone curve: bend 0 is identity, positive brightens the`,
            `// midtones, negative darkens. The exponent stays positive, so pow`,
            `// never sees a negative base.`,
            `const ${name} = (p: TSLNode) =>`,
            `  pow(clamp(${input}(p), 0, 1), exp2(${bend}.mul(-2)));`,
            '',
          );
          fieldNames.set(node.id, name);

          return name;
        }

        case 'blend': {
          const baseNode = upstreamOf(node.id, 'in');
          const overlayNode = upstreamOf(node.id, 'with');
          const baseField = emitField(baseNode);

          if (overlayNode === null) {
            fieldNames.set(node.id, baseField);

            return baseField;
          }

          const overlay = emitField(overlayNode);
          const base = emission.claim('blend');
          const name = `${base}Field`;
          const amount = emitDial(node, base, 'amount');
          const mode = String(node.params.mode ?? 'mix');

          // The select baked this branch into the shader; emit only the
          // chosen math, with the mode named in a comment.
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
          fieldNames.set(node.id, name);

          return name;
        }

        case 'colorRamp':
        case 'tone':
        case 'output':
          return flatField();
      }
    } finally {
      visiting.delete(node.id);
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

          const stops = RAMP_HEX.map((hex, index) => {
            const position = Number((index / (RAMP_HEX.length - 1)).toFixed(4));

            return `  { position: ${position}, color: vec3(...parseColorString('${hex}')) },`;
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

        case 'tone': {
          const inputName = emitColor(upstreamOf(node.id, 'in'));
          const base = emission.claim('tone');
          const name = `${base}Color`;
          const bend = emitDial(node, base, 'bend');

          for (const used of ['pow', 'clamp', 'exp2', 'vec3']) emission.tslImports.add(used);
          emission.helperLines.push(
            `// Tone curve over the finished image, per channel in linear RGB.`,
            `const ${name} = pow(clamp(${inputName ?? EMPTY_COLOR}, 0, 1), exp2(${bend}.mul(-2)));`,
            '',
          );
          colorNames.set(node.id, name);

          return name;
        }

        case 'gradient':
        case 'noise':
        case 'warp':
        case 'curve':
        case 'blend':
        case 'output':
          return null;
      }
    } finally {
      visiting.delete(node.id);
    }
  }

  const outputNode = nodesById.get(outputId) ?? null;
  const finalColor = outputNode === null ? null : emitColor(upstreamOf(outputNode.id, 'in'));

  if (finalColor === null) emission.tslImports.add('vec3');

  return assembleFile(emission, finalColor ?? EMPTY_COLOR);
}

// ---------------------------------------------------------------------------
// File assembly — imports, props interface, component shell
// ---------------------------------------------------------------------------

function assembleFile(emission: Emission, finalColorExpr: string): string {
  const sortedTsl = [...emission.tslImports].sort();
  const sortedMatter = [...emission.matterImports].sort();

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

  const effectDeps = ['shaderContext', ...emission.props.map((prop) => prop.name)].join(', ');

  const indent = (line: string) => (line === '' ? '' : `    ${line}`);
  const uniformBlock = emission.uniformLines.map(indent).join('\n');
  const helperBlock = emission.helperLines.map(indent).join('\n');

  const matterImportLine =
    sortedMatter.length > 0 ? `import { ${sortedMatter.join(', ')} } from '@lovo/matter';\n` : '';
  const parseColorLine = emission.usesParseColor
    ? `import { parseColorString } from '@lovo/matter/color';\n`
    : '';

  return `'use client';

// Generated by the Matter editor probe (MAT-96 spike). A bare Matter
// component: mount it inside a ShaderScene. Fields are functions of the
// sample position — warping is calling a field at a shifted point — and
// every editor dial arrived below as a prop with the editor's value as its
// default.
import { useEffect } from 'react';

${matterImportLine}import { useShaderContext } from '@lovo/matter-react';
${parseColorLine}import { ${sortedTsl.join(', ')} } from 'three/tsl';
import type { ShaderNodeObject } from 'three/tsl';
import { Mesh, MeshBasicNodeMaterial, PlaneGeometry } from 'three/webgpu';
import type { Node } from 'three/webgpu';

type TSLNode = ShaderNodeObject<Node>;

${propsBlock}${signature}
  const shaderContext = useShaderContext();

  useEffect(() => {
    if (!shaderContext) return;

    // Dials ride uniforms. This generated component rebuilds its material on
    // prop change (the deps below), which is spike shorthand — the registry
    // pattern pushes new values through stable uniforms instead.
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

// Guards the fix for MAT-92: the PCG constants must sit in the node graph
// as uint-typed constants. A bare JS number becomes a float-typed constant,
// which the GLSL backend emits as an f32 literal — and none of the three
// PCG constants survive f32's 24-bit mantissa (747796405 rounds to
// 747796416, 2891336453 to 2891336448, 277803737 to 277803744). WGSL
// const-evaluates the same literal at 64-bit precision, so the two backends
// run different hashes. Uint-typed constants emit as integer literals
// (747796405u), which are exact in both languages.
import type { ShaderNodeObject } from 'three/tsl';
import { float } from 'three/tsl';
import type { Node } from 'three/webgpu';
import { describe, expect, it } from 'vitest';

import { stableHash, stableHashUint } from './stable-hash.js';

const PCG_CONSTANTS = [747796405, 2891336453, 277803737];

interface GraphNode {
  isNode?: boolean;
  nodeType?: string;
  value?: unknown;
  method?: string;
  bNode?: GraphNode;
  // TSL wraps nodes in a proxy; `self` is the proxy's escape hatch back to
  // the raw node. Walking raw nodes matters: the proxy intercepts property
  // access (swizzles, assign sugar), so generic traversal only behaves on
  // the real object.
  self?: GraphNode;
  getSerializeChildren?: () => Iterable<{ childNode: GraphNode }>;
}

// Walk every node reachable from the root, depth-first.
// getSerializeChildren is three's own traversal (it iterates a node's
// public properties and yields the ones that are nodes), so anything
// codegen would visit, this visits.
function collectNodes(root: GraphNode, visited = new Set<GraphNode>()): GraphNode[] {
  if (visited.has(root)) return [];
  visited.add(root);
  const nodes = [root];

  if (root.getSerializeChildren) {
    for (const { childNode } of root.getSerializeChildren()) {
      nodes.push(...collectNodes(childNode, visited));
    }
  }

  return nodes;
}

// stableHashUint's PCG body now lives inside a laid-out Fn (see stable-hash.ts's
// pcgHash), which is the fix the "lays out stableHashUint..." test below
// protects: calling stableHashUint returns only a function-call node, and
// its type comes from the layout instead of a walk into the body. One
// consequence is that the PCG constants below are no longer reachable by
// walking stableHashUint(seed) itself — they live inside the Fn's closure,
// which three only invokes when it actually builds the layout. That
// closure is pure TSL node-building code, no builder required, so reach it
// directly to keep proving MAT-92's invariant: every PCG constant is a
// uint-typed node, never float.
function buildPcgBody(seed: ShaderNodeObject<Node>): GraphNode {
  const proxied = stableHashUint(seed) as unknown as GraphNode;
  const callNode = (proxied.self ?? proxied) as unknown as {
    shaderNode: { jsFunc: (inputs: unknown[]) => GraphNode };
  };

  return callNode.shaderNode.jsFunc([seed]);
}

describe('stableHash', () => {
  it('returns a node', () => {
    expect(stableHash(float(1))).toBeDefined();
  });

  it('caps the float output below 1 through min()', () => {
    // toFloat() rounds hash words at or above 0xFFFFFF80 up to 2^32, which
    // would scale to an exact 1.0 and break the [0, 1) contract. No GPU runs
    // in this suite, so assert the structure instead: a min() MathNode whose
    // second operand is the cap. Matching the constant alone would pass with
    // the cap attached to anything at all.
    const proxied = stableHash(float(1)) as unknown as GraphNode;
    const nodes = collectNodes(proxied.self ?? proxied);
    const caps = nodes.filter(
      (node) => node.method === 'min' && node.bNode?.value === 1 - 2 ** -24,
    );

    expect(caps.length).toBe(1);
  });

  it('stableHashUint carries every PCG constant as a uint-typed node', () => {
    const outputNode = buildPcgBody(float(1));
    const nodes = collectNodes(outputNode.self ?? outputNode);
    const found = new Set<number>();

    for (const node of nodes) {
      if (typeof node.value === 'number' && PCG_CONSTANTS.includes(node.value)) {
        expect(node.nodeType, `constant ${node.value}`).toBe('uint');
        found.add(node.value);
      }
    }

    expect([...found].sort()).toEqual([...PCG_CONSTANTS].sort());
  });

  it('carries every PCG constant as a uint-typed node, never float', () => {
    // Walk stableHash's own composed graph, not the Fn's closure: the PCG
    // body now builds behind stableHashUint's call node (see buildPcgBody's
    // comment above), so this composed graph may not reach the PCG
    // constants at all anymore — finding none is fine. What must never
    // happen is a float-typed copy showing up here, which would
    // reintroduce MAT-92's divergence.
    const proxied = stableHash(float(1)) as unknown as GraphNode;
    const nodes = collectNodes(proxied.self ?? proxied);

    const constantsFound = new Map<number, string[]>();

    for (const node of nodes) {
      if (typeof node.value === 'number' && PCG_CONSTANTS.includes(node.value)) {
        const types = constantsFound.get(node.value) ?? [];

        types.push(node.nodeType ?? 'unknown');
        constantsFound.set(node.value, types);
      }
    }

    for (const [value, types] of constantsFound) {
      for (const type of types) {
        expect(type, `constant ${value} must be uint, got ${type}`).toBe('uint');
      }
    }
  });

  it('lays out stableHashUint so its type comes from the layout, not a walk into the PCG body', () => {
    // Every Fn(...) call returns a ShaderCallNodeInternal, laid out or not
    // — checking the constructor alone would still pass with the
    // .setLayout() call deleted, and the 19-second regression back with
    // it. What actually stops three's unmemoized getNodeType walk is the
    // layout: ShaderCallNodeInternal.getNodeType reads shaderNode.nodeType
    // (unset here), falls through to getOutputNode(), and it's call()'s
    // `if (shaderNode.layout)` check that switches to the declared type
    // instead of building the PCG body. Assert the layout is actually
    // there, through the same `.shaderNode` reach buildPcgBody uses above.
    const proxied = stableHashUint(float(1)) as unknown as GraphNode;
    const raw = (proxied.self ?? proxied) as unknown as {
      constructor: { name: string };
      shaderNode: { layout: unknown };
    };

    expect(raw.constructor.name).toBe('ShaderCallNodeInternal');
    expect(raw.shaderNode.layout).toMatchObject({ name: 'stableHashUint', type: 'uint' });
  });
});

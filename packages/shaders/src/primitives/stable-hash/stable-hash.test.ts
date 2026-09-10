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
// pcgHash), which is the fix this file's "deeply nested chain" test below
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
    // stableHash's own body adds only the [0, 1) scale and cap constants;
    // the PCG constants it must not leak as float come from the
    // stableHashUint it calls, so reach that Fn's body the same way as the
    // test above.
    const outputNode = buildPcgBody(float(1));
    const nodes = collectNodes(outputNode.self ?? outputNode);

    const constantsFound = new Map<number, string[]>();

    for (const node of nodes) {
      if (typeof node.value === 'number' && PCG_CONSTANTS.includes(node.value)) {
        const types = constantsFound.get(node.value) ?? [];

        types.push(node.nodeType ?? 'unknown');
        constantsFound.set(node.value, types);
      }
    }

    // All three constants must be present...
    expect([...constantsFound.keys()].sort()).toEqual([...PCG_CONSTANTS].sort());

    // ...and every occurrence must be typed uint. A single float-typed copy
    // reintroduces the divergence.
    for (const [value, types] of constantsFound) {
      for (const type of types) {
        expect(type, `constant ${value} must be uint, got ${type}`).toBe('uint');
      }
    }
  });

  it('resolves the type of a deeply nested chain in bounded time', () => {
    // Six levels of nesting is what LedWall builds. Before stableHashUint
    // became a laid-out Fn, three walked the whole inline PCG body once per
    // reference per level, and this chain took seconds to type at shader
    // build; with the layout, a call site's type is read from the layout
    // and the walk stops there.
    //
    // No test in this package constructs a real NodeBuilder — three's
    // NodeBuilder needs a renderer and a WGSL/GLSL parser, not something a
    // unit test should spin up — so this asserts structure instead of
    // timing a `getNodeType(builder)` call: stableHashUint(seed) must
    // return a function-call node (three's ShaderCallNodeInternal) rather
    // than the raw arithmetic graph. A call node's own getNodeType defers
    // to the laid-out function's declared type instead of recursing into
    // the PCG body, which is what keeps nesting cheap.
    let seed: ShaderNodeObject<Node> = float(1);

    for (let level = 0; level < 6; level++) seed = stableHashUint(seed);

    const proxied = seed as unknown as GraphNode;
    const raw = (proxied.self ?? proxied) as unknown as { constructor: { name: string } };

    expect(raw.constructor.name).toBe('ShaderCallNodeInternal');
  });
});

// Guards the fix for MAT-92: the PCG constants must sit in the node graph
// as uint-typed constants. A bare JS number becomes a float-typed constant,
// which the GLSL backend emits as an f32 literal — and none of the three
// PCG constants survive f32's 24-bit mantissa (747796405 rounds to
// 747796416, 2891336453 to 2891336448, 277803737 to 277803744). WGSL
// const-evaluates the same literal at 64-bit precision, so the two backends
// run different hashes. Uint-typed constants emit as integer literals
// (747796405u), which are exact in both languages.
import { float } from 'three/tsl';
import { describe, expect, it } from 'vitest';

import { stableHash, stableHashUint } from './stable-hash.js';

const PCG_CONSTANTS = [747796405, 2891336453, 277803737];

interface GraphNode {
  isNode?: boolean;
  nodeType?: string;
  value?: unknown;
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

describe('stableHash', () => {
  it('returns a node', () => {
    expect(stableHash(float(1))).toBeDefined();
  });

  it('caps the float output below 1', () => {
    // toFloat() rounds hash words at or above 0xFFFFFF80 up to 2^32, which
    // would scale to an exact 1.0 and break the [0, 1) contract. The cap is
    // min(x, 1 - 2^-24); this walk asserts the cap constant survives in the
    // graph, since no GPU runs in this suite.
    const proxied = stableHash(float(1)) as unknown as GraphNode;
    const nodes = collectNodes(proxied.self ?? proxied);
    const cap = nodes.filter((node) => node.value === 1 - 2 ** -24);

    expect(cap.length).toBeGreaterThan(0);
  });

  it('stableHashUint carries every PCG constant as a uint-typed node', () => {
    const proxied = stableHashUint(float(1)) as unknown as GraphNode;
    const nodes = collectNodes(proxied.self ?? proxied);
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
});

// A typed wrapper over TSL's Fn().setLayout(), which emits a TSL function as
// one named GPU function instead of inlining its body at every call. The
// Blender ports call their noise and hash functions hundreds of times per
// pixel, so every heavy one goes through here.
import type { equal, ShaderNodeObject } from 'three/tsl';
import { Fn } from 'three/tsl';
import type { Node } from 'three/webgpu';

export type TSLNode = ShaderNodeObject<Node>;

// three 0.170 defines notEqual on every node at runtime (OperatorNode.js
// chains it next to equal), but @types/three 0.170 leaves it out, as the
// type notes in docs/agents/tsl.md say.
declare module 'three/src/nodes/tsl/TSLCore.js' {
  interface NodeElements {
    notEqual: typeof equal;
  }
}

// A GPU type name, as three's code builders spell them.
export type GpuType = 'float' | 'uint' | 'vec3' | 'ivec3' | 'vec4';

type Inputs = ReadonlyArray<readonly [name: string, type: GpuType]>;

// One node per declared input, as a tuple, so destructuring stays typed.
type Args<I extends Inputs> = { -readonly [K in keyof I]: TSLNode };

// The shape three's Fn returns at runtime. @types/three 0.170 omits
// setLayout, which three.webgpu.js defines on every Fn, as the same cast in
// packages/shaders/src/primitives/stable-hash/stable-hash.ts explains.
interface LayoutFn {
  (...args: TSLNode[]): TSLNode;
  setLayout(layout: {
    name: string;
    type: GpuType;
    inputs: Array<{ name: string; type: GpuType }>;
  }): LayoutFn;
}

/**
 * Build a named GPU function. A laid-out function also stops three's type
 * resolution at the call site, which otherwise walks the whole body again
 * for every reference, as the running-minimum gotcha in docs/agents/tsl.md
 * describes.
 */
export function gpuFunction<const I extends Inputs>(
  name: string,
  type: GpuType,
  inputs: I,
  body: (args: Args<I>) => TSLNode,
): (...args: Args<I>) => TSLNode {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- @types/three 0.170 omits setLayout, which three.webgpu.js defines on every Fn
  const fn = Fn(body as (args: TSLNode[]) => TSLNode) as unknown as LayoutFn;

  return fn.setLayout({
    name,
    type,
    inputs: inputs.map(([inputName, inputType]) => ({ name: inputName, type: inputType })),
  });
}

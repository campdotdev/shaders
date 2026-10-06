// Draws one TSL node into a texture of its own, so a shader can read back an
// answer instead of working it out per pixel. Aurora draws its 60 slice
// colors into one, and each march step reads its texel (one pixel of a
// texture). Like the output stage and the wave field beside it, it is
// written against three's renderer alone, with no React.
import type { ShaderNodeObject } from 'three/tsl';
import {
  ClampToEdgeWrapping,
  type Node,
  NodeMaterial,
  QuadMesh,
  type RedFormat,
  RenderTarget,
  RGBAFormat,
  type Texture,
  type WebGPURenderer,
} from 'three/webgpu';

import {
  canRenderTo,
  isDeviceLost,
  type TargetFilter,
  type TargetType,
} from '../renderer-capabilities/renderer-capabilities.js';

export interface TexturePassOptions {
  /** Width of the texture, in texels. */
  width: number;
  /** Height of the texture, in texels. */
  height: number;
  /**
   * What each channel of a texel holds: three's UnsignedByteType for 8-bit
   * color, HalfFloatType for 16-bit floats, or FloatType for full 32-bit
   * floats. A float keeps sign, values past 1, and fractions an 8-bit
   * channel would round away.
   */
  type: TargetType;
  /**
   * How a read between texel centers blends: NearestFilter returns the
   * nearest texel as stored, LinearFilter mixes the four around it.
   */
  filter: TargetFilter;
  /**
   * How many channels a texel holds: RGBAFormat for four, RedFormat for one.
   * A one-channel texture keeps only the node's first component and stores
   * a quarter of the bytes, which a pass drawn every frame saves on every
   * write and every read. Defaults to RGBAFormat.
   */
  format?: typeof RGBAFormat | typeof RedFormat;
}

export interface TexturePass {
  /**
   * The texture the node is drawn into. Null when the renderer cannot draw
   * into the requested type, after a lost device, and after dispose. The
   * consumer then works the value out inline instead.
   */
  readonly texture: Texture | null;
  /** Draw the node into the texture, once per call. */
  render: () => void;
  /**
   * Change the texture's size in texels. The texture object stays the same,
   * so a texture node bound to it stays bound, but its contents are gone
   * until the next render.
   */
  resize: (width: number, height: number) => void;
  /** Release the texture and the material. The renderer stays the caller's. */
  dispose: () => void;
}

// What a renderer that cannot use the requested target gets: a pass with
// nothing behind it, whose null texture tells the consumer to fall back.
const inertPass: TexturePass = {
  texture: null,
  render: () => {
    // No target to draw into.
  },
  resize: () => {
    // No target to resize.
  },
  dispose: () => {
    // Nothing was allocated.
  },
};

export function createTexturePass(
  renderer: WebGPURenderer,
  node: Node | ShaderNodeObject<Node>,
  { width, height, type, filter, format = RGBAFormat }: TexturePassOptions,
): TexturePass {
  if (!canRenderTo(renderer, type, filter) || isDeviceLost(renderer)) return inertPass;

  // ----------------------------------------------------------------------------
  // The target and the quad
  // ----------------------------------------------------------------------------

  // A render target is a texture the GPU can draw into instead of the canvas.
  // Every backend that renders to a texel type renders to its one-channel
  // and four-channel formats alike, so the format needs no check of its own.
  // Clamping keeps a read past the edge on the edge texel. Nothing here
  // tests depth, and the texture is read at the one size it was drawn at,
  // so it keeps no depth buffer and no mipmaps (smaller copies for reading
  // it shrunk).
  let target: RenderTarget | null = new RenderTarget(width, height, {
    type,
    format,
    minFilter: filter,
    magFilter: filter,
    wrapS: ClampToEdgeWrapping,
    wrapT: ClampToEdgeWrapping,
    depthBuffer: false,
    stencilBuffer: false,
    generateMipmaps: false,
  });

  // One quad that covers the target, so the node runs once per texel. Inside
  // the node, uv() is that texel's 0..1 position. fragmentNode replaces the
  // material's whole output, so the node's value lands in the texel as is,
  // with no lighting, tone mapping, or color-space conversion.
  const material = new NodeMaterial();

  material.name = 'TexturePass';
  material.fragmentNode = node;
  const quad = new QuadMesh(material);

  // ----------------------------------------------------------------------------
  // Going inert
  // ----------------------------------------------------------------------------

  // Release the target and the material and forget them. Nothing recreates
  // them, so from here `texture` reads null and every later call is a no-op.
  //
  // The material dispose can throw. Disposing three's renderer clears its
  // records of every material it drew, and a later dispose of one of those
  // materials reads a cleared record and throws. ShaderScene disposes its
  // renderer before its children's cleanups run, so a component that
  // disposes this pass on unmount always meets that case. The renderer has
  // already dropped its references to the material's pipeline by then, so
  // swallowing the throw leaves nothing behind.
  const dropTarget = () => {
    if (target === null) return;
    target.dispose();
    target = null;
    try {
      material.dispose();
    } catch {
      // The renderer is already gone, see above.
    }
  };

  // Whether the pass still has its target. A lost device is noticed here, on
  // whichever call comes first, so `texture` goes null without waiting for a
  // render: three only flags the loss and turns later draws into no-ops.
  const alive = () => {
    if (target !== null && isDeviceLost(renderer)) dropTarget();

    return target !== null;
  };

  return {
    get texture() {
      alive();

      return target?.texture ?? null;
    },

    // Bind the target, draw the quad into it, and put back whatever target
    // was bound before, in a finally block so a draw that throws (a lost
    // device) cannot leave the scene drawing into this texture. The throw
    // is swallowed and the pass dropped, so the caller's frame carries on.
    render() {
      if (!alive() || target === null) return;
      const previousTarget = renderer.getRenderTarget();

      try {
        renderer.setRenderTarget(target);
        quad.render(renderer);
      } catch {
        dropTarget();
      } finally {
        renderer.setRenderTarget(previousTarget);
      }
    },

    // setSize keeps the texture object and frees its GPU memory, which three
    // reallocates at the new size on the next draw.
    resize(nextWidth, nextHeight) {
      if (!alive()) return;
      target?.setSize(nextWidth, nextHeight);
    },

    dispose() {
      dropTarget();
    },
  };
}

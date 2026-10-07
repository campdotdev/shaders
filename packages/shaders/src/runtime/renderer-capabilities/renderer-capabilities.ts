// What a renderer can do beyond drawing to the canvas, for the runtime
// modules that draw into render targets (textures the GPU draws into instead
// of the canvas): the wave field and the texture pass. Each question reads
// three internals its public API does not answer, so they live here once,
// behind `in` guards, to re-check in one place at a three bump.
import {
  FloatType,
  HalfFloatType,
  LinearFilter,
  type NearestFilter,
  type UnsignedByteType,
  type WebGPURenderer,
} from 'three/webgpu';

/**
 * What each channel of a target's texel holds: an 8-bit integer, a half
 * float, or a full float. three's other texel types make targets these
 * modules cannot use. The signed and wider integer types make integer
 * targets, which a float shader output cannot draw into, or a signed 8-bit
 * one, which core WebGPU cannot render to, and three has no RGBA format for
 * the packed types.
 */
export type TargetType = typeof UnsignedByteType | typeof HalfFloatType | typeof FloatType;

/** How a read between texel centers blends: not at all, or linearly. */
export type TargetFilter = typeof NearestFilter | typeof LinearFilter;

/**
 * Whether three's WebGL2 extension registry lists `name`. three's
 * hasFeature() table does not map the float extensions, so this reads the
 * backend's registry directly, the way create-renderer reads its
 * isWebGLBackend flag: both are internal fields. three enables every
 * extension this module asks about when the backend initializes.
 */
function hasWebGLExtension(backend: object, name: string): boolean {
  if (!('extensions' in backend)) return false;
  const extensions: unknown = backend.extensions;

  if (typeof extensions !== 'object' || extensions === null || !('has' in extensions)) return false;
  const has: unknown = extensions.has;

  return typeof has === 'function' && has.call(extensions, name) === true;
}

/**
 * Whether the renderer can draw into a render target of this texel type and
 * then let a shader sample it with this filter. The texel type is what each
 * channel of a texel (one pixel of a texture) holds: an 8-bit integer, or a
 * float, which keeps sign and values past 1. A half float has 16 bits, about
 * three significant digits. A full float has 32 bits, about seven.
 *
 * - 8-bit targets work everywhere.
 * - WebGL2 renders to half and full floats only with EXT_color_buffer_float,
 *   and filters a full float between texels only with
 *   OES_texture_float_linear.
 * - WebGPU renders to both float types in core. three 0.170 binds every
 *   render target's texture as filterable, though, and WebGPU accepts that
 *   for a full float only on a device with the float32-filterable feature,
 *   whatever filter the texture asks for (the float32-filterable gotcha in
 *   docs/agents/tsl.md). Half floats are filterable in core.
 */
export function canRenderTo(
  renderer: WebGPURenderer,
  type: TargetType,
  filter: TargetFilter,
): boolean {
  const isFloat = type === FloatType;

  if (!isFloat && type !== HalfFloatType) return true;
  const backend: unknown = renderer.backend;

  if (typeof backend !== 'object' || backend === null) return false;
  if (!('isWebGLBackend' in backend) || backend.isWebGLBackend !== true) {
    if (!isFloat) return true;
    // @types/three 0.170 declares hasFeature as `false | void`, but it
    // returns the device's answer as a boolean, so read it as unknown.
    const filterable: unknown = renderer.hasFeature('float32-filterable');

    return filterable === true;
  }
  if (!hasWebGLExtension(backend, 'EXT_color_buffer_float')) return false;

  return (
    !isFloat || filter !== LinearFilter || hasWebGLExtension(backend, 'OES_texture_float_linear')
  );
}

/**
 * The longest side WebGL2 promises a texture can have, in texels. WebGPU
 * promises 8192, so every backend allows at least this.
 */
const GUARANTEED_TEXTURE_SIDE = 2048;

/** `value[key]` when value is an object that has that key, else undefined. */
function readField(value: unknown, key: string): unknown {
  if (typeof value !== 'object' || value === null || !(key in value)) return undefined;
  const field: unknown = Reflect.get(value, key);

  return field;
}

/**
 * The longest side, in texels, of a texture the renderer's device can
 * allocate. Past it, WebGL2 fails the allocation and leaves the texture
 * unreadable. Desktop GPUs allow 4096 or more, but WebGL2 lets a device
 * stop at 2048. The WebGL2 fallback reads MAX_TEXTURE_SIZE off its context,
 * and the WebGPU backend reads the limit off its device, both internal
 * fields. A backend that has neither yet answers 2048, the side every
 * backend allows.
 */
export function maxTextureSide(renderer: WebGPURenderer): number {
  const backend: unknown = renderer.backend;
  let side: unknown;

  if (readField(backend, 'isWebGLBackend') === true) {
    const gl = readField(backend, 'gl');
    const getParameter = readField(gl, 'getParameter');

    side =
      typeof getParameter === 'function'
        ? getParameter.call(gl, readField(gl, 'MAX_TEXTURE_SIZE'))
        : undefined;
  } else {
    side = readField(readField(readField(backend, 'device'), 'limits'), 'maxTextureDimension2D');
  }

  return typeof side === 'number' && side > 0 ? side : GUARANTEED_TEXTURE_SIDE;
}

/**
 * Whether three's renderer has recorded a lost device. It keeps that on a
 * private `_isDeviceLost` field and turns every later draw into a silent
 * no-op rather than a throw, so the flag is the only early signal. Re-check
 * the field name at any three bump.
 */
export function isDeviceLost(renderer: WebGPURenderer): boolean {
  const candidate: unknown = renderer;

  return (
    typeof candidate === 'object' &&
    candidate !== null &&
    '_isDeviceLost' in candidate &&
    candidate._isDeviceLost === true
  );
}

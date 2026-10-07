// The geometry of Aurora's sky: where each pixel's view ray points, and how
// far along it each march step samples. The shader (./shader.tsx) marches
// with these numbers on the GPU. The CPU uses them here to find the patch of
// the sky plane those samples reach. The field pass, a draw into a texture
// that runs before the scene each frame, covers that patch, so the texture
// and the march always agree. Distances are in sky units, the units of the
// plane the field lives on.

// ----------------------------------------------------------------------------
// The view ray
// ----------------------------------------------------------------------------

/**
 * Raymarch slice count. More slices smooth the banding between slices, and
 * each one is another pass through the march loop for every pixel.
 */
export const STEP_COUNT = 60;

/**
 * The view ray's height (y) before it is normalized, at the canvas's bottom
 * and top edges. The bottom sits just above the geometry's horizon at -0.2,
 * below which march distances flip negative and sample behind the camera,
 * so the whole canvas is valid sky and the curtain band spans its height.
 */
export const RAY_Y_AT_BOTTOM = -0.03;
export const RAY_Y_AT_TOP = 1;

/**
 * The view ray's forward (z) component before it is normalized: the virtual
 * camera's focal length. Larger narrows the field of view.
 */
export const FOCAL_LENGTH = 1.064;

/**
 * Where every ray starts, in sky units on each axis. Moving it slides the
 * camera across the field, so the curtains show a different stretch of it.
 */
export const RAY_ORIGIN = 5.5;

// ----------------------------------------------------------------------------
// The march
// ----------------------------------------------------------------------------
// Step i samples at (FIRST_SLICE + SLICE_SPREAD * i^SLICE_CURVE) along the
// ray, divided by the horizon bend, (HORIZON_BEND * rayY + BEND_OFFSET).

/**
 * How far along a ray the first slice sits, in sky units before the horizon
 * bend. Larger pushes every slice further from the camera.
 */
export const FIRST_SLICE = 0.8;

/**
 * How the slices spread out. SLICE_CURVE above 1 packs them tight at the
 * base, where the curtain's sharp bottom edge is, and spreads them with
 * height. SLICE_SPREAD scales the whole stack.
 */
export const SLICE_SPREAD = 0.002;
export const SLICE_CURVE = 1.4;

/**
 * The bent divisor that fakes atmospheric curvature: a ray grazing the
 * horizon (rayY near -0.2) divides by nearly 0 and pushes its samples far
 * out toward the horizon line, and a ray looking up divides by more and
 * stays close.
 */
export const HORIZON_BEND = 2;
export const BEND_OFFSET = 0.4;

// ----------------------------------------------------------------------------
// The patch of sky the march reaches
// ----------------------------------------------------------------------------

/**
 * A rectangle on the sky plane, the horizontal plane the field lives on.
 * x runs across the screen, and z runs away from the camera toward the
 * horizon.
 */
export interface SkyPatch {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/**
 * Where step `stepIndex` of the ray through (u, v) samples, as [x, z] on the
 * sky plane. (u, v) is the pixel's 0..1 position from the canvas's
 * bottom-left. The shader subtracts a small per-pixel jitter from the
 * distance, which only pulls a sample back toward the camera and never
 * past the first slice, so the patch leaves it out.
 */
function samplePoint(u: number, v: number, aspect: number, stepIndex: number) {
  const rayX = (u - 0.5) * 2 * aspect;
  const rayY = v * (RAY_Y_AT_TOP - RAY_Y_AT_BOTTOM) + RAY_Y_AT_BOTTOM;
  const length = Math.hypot(rayX, rayY, FOCAL_LENGTH);
  const distance =
    (SLICE_SPREAD * stepIndex ** SLICE_CURVE + FIRST_SLICE) /
    (HORIZON_BEND * (rayY / length) + BEND_OFFSET);

  return [
    RAY_ORIGIN + (rayX / length) * distance,
    RAY_ORIGIN + (FOCAL_LENGTH / length) * distance,
  ] as const;
}

/** Pixels sampled along each edge. Odd, so the walk passes the center column. */
const PIXELS_PER_EDGE = 129;

/**
 * How much the patch grows on each side, as a share of its span, so a
 * sample between two walked pixels stays inside.
 */
const PATCH_MARGIN = 0.002;

/**
 * The patch of the sky plane that every march sample of every pixel lands
 * in, for a canvas of this aspect ratio (width / height).
 *
 * The farthest samples leave from the canvas's top and bottom edges, at the
 * first or the last step. Moving a pixel up or down slides every one of its
 * samples the same way across the plane, so no pixel between the two edges
 * reaches past both of them, and each sample sits further out the later its
 * step. So the walk covers only those two edges at those two steps.
 */
export function skyPatch(aspect: number): SkyPatch {
  const patch: SkyPatch = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };

  for (let pixel = 0; pixel < PIXELS_PER_EDGE; pixel += 1) {
    const u = pixel / (PIXELS_PER_EDGE - 1);

    for (const v of [0, 1]) {
      for (const stepIndex of [0, STEP_COUNT - 1]) {
        const [x, z] = samplePoint(u, v, aspect, stepIndex);

        patch.minX = Math.min(patch.minX, x);
        patch.maxX = Math.max(patch.maxX, x);
        patch.minZ = Math.min(patch.minZ, z);
        patch.maxZ = Math.max(patch.maxZ, z);
      }
    }
  }

  const marginX = (patch.maxX - patch.minX) * PATCH_MARGIN;
  const marginZ = (patch.maxZ - patch.minZ) * PATCH_MARGIN;

  return {
    minX: patch.minX - marginX,
    maxX: patch.maxX + marginX,
    minZ: patch.minZ - marginZ,
    maxZ: patch.maxZ + marginZ,
  };
}

// ----------------------------------------------------------------------------
// The field texture's size
// ----------------------------------------------------------------------------

/**
 * The longest side the field texture may have, in texels. Every desktop GPU
 * allows at least 4096, and a full-width canvas at 2x on a 2560-pixel
 * display needs about 4500 at density 1. WebGL2 promises only 2048, so the
 * texture pass clamps each side again to the device's own limit.
 */
const MAX_FIELD_SIDE = 4096;

/**
 * The field texture's size in texels (the pixels of a texture), for a patch
 * drawn on a canvas of `pixelWidth` by `pixelHeight` device pixels.
 *
 * `density` is texels per device pixel along each side: at 1 the texture
 * has as many texels as the canvas has pixels, and at 0.5 a quarter as
 * many, which makes the field pass about 4x cheaper. The texels are spread
 * so each one is square on the sky plane, covering the same distance across
 * the screen as toward the horizon. A read between texel centers blends
 * the nearest four (linear filtering), so square texels blur the field the
 * same amount both ways. A side clamped at MAX_FIELD_SIDE stretches its
 * texels along that side.
 */
export function fieldTextureSize(
  { minX, maxX, minZ, maxZ }: SkyPatch,
  pixelWidth: number,
  pixelHeight: number,
  density: number,
): { width: number; height: number } {
  const spanX = maxX - minX;
  const spanZ = maxZ - minZ;
  const texelCount = pixelWidth * pixelHeight * density ** 2;
  // The side of one square texel, in sky units: the patch's area shared out
  // over the texels. A collapsed canvas has no texels, so the side is
  // infinite and both sides round to the 1-texel floor.
  const texelSide = Math.sqrt((spanX * spanZ) / texelCount);
  const texelsAcross = (span: number) =>
    Math.min(Math.max(Math.round(span / texelSide), 1), MAX_FIELD_SIDE);

  return { width: texelsAcross(spanX), height: texelsAcross(spanZ) };
}

// The browser half of the custom-mark atlas: turn a tile plan (./plan.ts)
// into a texture the shader can sample. The browser rasterizes each SVG
// through an image element into one canvas laid out by the plan, and that
// canvas becomes a mipmapped texture. Browser-only on purpose: the engine
// already needs a renderer, which cannot run on the server either.
import { CanvasTexture, DataTexture, type Texture } from 'three';

import type { MarkTilePlan } from './plan.js';

// ---------------------------------------------
// The placeholder
// ---------------------------------------------
// A one-pixel, fully transparent texture the shader samples until the
// decode lands. Every read comes back with alpha 0, so custom cells draw
// nothing on the first frame while built-in cells draw at once. A texture
// is a GPU image: the shader cannot wait for one, so it needs something
// valid to read from the moment it compiles. One shared instance, made on
// first use and never disposed, the same as the dither primitive's blue
// noise tile: every field starts from it and swaps in its own atlas, so
// no field owns it and no unmount can pull it out from under another.
let placeholder: Texture | null = null;

export function getMarkAtlasPlaceholder(): Texture {
  if (placeholder === null) {
    placeholder = new DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1);
    placeholder.needsUpdate = true;
  }

  return placeholder;
}

// ---------------------------------------------
// The decode
// ---------------------------------------------
/**
 * Draws every tile in the plan into one canvas and wraps it as a texture.
 * Resolves once the browser has rasterized all of them, which is a few
 * milliseconds after mount. The caller swaps the result in for the
 * placeholder, so a texture that resolves after its field unmounted is
 * disposed rather than used. Rejects when the browser cannot decode a
 * mark; what a rejection does to the field is the next ticket's.
 *
 * The texture keeps three's defaults, which generate mipmaps: a pyramid
 * of half-size copies of the atlas, each averaging a 2x2 block of the one
 * above, that the GPU samples from when a mark is drawn smaller than its
 * tile. Without them a 128px tile drawn at a 3px `dotSize` would pick one
 * texel in forty per screen pixel, and the mark would sparkle as it
 * moved. The plan's tile padding exists so those averaged copies do not
 * blend neighboring marks together.
 */
export async function decodeMarkAtlas(plan: MarkTilePlan): Promise<CanvasTexture> {
  const canvas = document.createElement('canvas');

  canvas.width = plan.width;
  canvas.height = plan.height;

  const context = canvas.getContext('2d');

  if (context === null) throw new Error('DotField: could not get a 2d canvas context');

  await Promise.all(
    plan.tiles.map(async ({ markup, rect }) => {
      const image = await loadSvgImage(markup, rect.width, rect.height);

      context.drawImage(image, rect.x, rect.y, rect.width, rect.height);
    }),
  );

  const atlas = new CanvasTexture(canvas);

  // Rows in the canvas count from the top, and the shader's atlas math does
  // too, so the upload must not flip the image the way three does by
  // default for images. With the flip off, texel row 0 is the canvas's top
  // row on both backends, and a v of 0 reads it.
  atlas.flipY = false;

  return atlas;
}

/**
 * Rasterizes one SVG through an image element at the size its tile
 * rectangle has. The root element's width and height are set to that size
 * first, because an SVG with only a viewBox has no intrinsic size, and
 * Firefox draws such an image to a canvas at zero size. A blob URL, not a
 * data URL, so the markup is not re-encoded, and the URL is released once
 * the image has decoded.
 */
async function loadSvgImage(
  markup: string,
  width: number,
  height: number,
): Promise<HTMLImageElement> {
  const svgDocument = new DOMParser().parseFromString(markup, 'image/svg+xml');
  const root = svgDocument.documentElement;

  root.setAttribute('width', String(width));
  root.setAttribute('height', String(height));

  const sized = new XMLSerializer().serializeToString(root);
  const url = URL.createObjectURL(new Blob([sized], { type: 'image/svg+xml' }));
  const image = new Image();

  try {
    image.src = url;
    await image.decode();
  } finally {
    URL.revokeObjectURL(url);
  }

  return image;
}

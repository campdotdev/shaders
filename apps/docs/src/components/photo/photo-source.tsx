'use client';

// The docs' photo Source: a photo across the canvas for an Effect demo to
// draw over, because a photo's edges and detail show a resample or a color
// transform plainly (ADR 0009). The package ships no image Source until v2,
// so this one uses public API: a plane that fills the scene's view, the way
// LinearGradient draws its gradient. A demo's scene.tsx decodes the photo
// with usePhoto before the scene mounts. cover.ts holds the fit.
import type { StaticImageData } from 'next/image';
import { useEffect, useMemo, useState } from 'react';

import { useResize, useShaderContext, useStaticSceneHint } from '@camp-dev/shaders';
import { texture, uniform, uv } from 'three/tsl';
import {
  Mesh,
  MeshBasicNodeMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  Texture,
  Vector2,
} from 'three/webgpu';

import { coverShare } from './cover';

// ---------------------------------------------
// Loading the photo
// ---------------------------------------------

/**
 * Loads and decodes the photo an image import points at, and returns it once
 * the browser can draw it. Until then it returns null. Next turns an image
 * import into an object with a `src`, and the poster CLI's bundler turns it
 * into a data URL string, so this takes either.
 */
export function usePhoto(source: StaticImageData | string): HTMLImageElement | null {
  const url = typeof source === 'string' ? source : source.src;
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);

  // decode() resolves once the pixels are ready to upload, so a scene that
  // waits for it never draws a frame without the photo.
  useEffect(() => {
    let cancelled = false;
    const image = new Image();

    image.src = url;
    image.decode().then(
      () => {
        if (!cancelled) setPhoto(image);
      },
      (error: unknown) => {
        console.error('PhotoSource: the photo failed to load.', error);
      },
    );

    return () => {
      cancelled = true;
    };
  }, [url]);

  return photo;
}

// ---------------------------------------------
// Drawing the photo
// ---------------------------------------------

/**
 * Draws `photo` across the canvas, cropped without stretching. Without
 * `frame` the photo covers the canvas and scales with it. With `frame` it
 * keeps the scale that covers the frame.
 */
export function PhotoSource({
  photo,
  frame,
}: {
  photo: HTMLImageElement;
  /**
   * The CSS size of the box the photo covers, centered on the canvas. The
   * canvas shows the middle of that box at the canvas's own size. A demo
   * whose poster renders pixel-locked passes its poster's size, so the
   * photo keeps the poster's scale. Leave it out to cover the canvas.
   */
  frame?: readonly [number, number];
}) {
  const shaderContext = useShaderContext();
  const resize = useResize();
  // The frame's two numbers, not the tuple, go into the fit effect's deps,
  // so a caller that passes a fresh tuple each render refits nothing.
  const frameWidth = frame?.[0];
  const frameHeight = frame?.[1];

  // A still photo changes nothing over time, so a scene of it can park.
  useStaticSceneHint(true);

  // The share of the photo the canvas shows along x and along y, from 0 to
  // 1. It lives in a uniform, so a resize moves the crop without rebuilding
  // the material.
  const coverVector = useMemo(() => new Vector2(1, 1), []);
  const coverUniform = useMemo(() => uniform(coverVector), [coverVector]);

  // The fit from cover.ts, refreshed on every resize. With a frame, the
  // canvas crops the photo the way DemoPoster's pixel-locked mode crops the
  // poster, so nothing zooms when the scene replaces the poster. The write
  // repaints nothing on a still scene by itself, so it asks for a frame (the
  // bare-uniform-write gotcha in docs/agents/tsl.md).
  useEffect(() => {
    const apply = () => {
      const [width, height] = resize.get();

      if (width <= 0 || height <= 0) return;
      const photoAspect = photo.naturalWidth / photo.naturalHeight;
      const fitFrame =
        frameWidth === undefined || frameHeight === undefined
          ? undefined
          : ([frameWidth, frameHeight] as const);

      coverVector.set(...coverShare(photoAspect, [width, height], fitFrame));
      shaderContext?.scheduler.requestRender();
    };

    apply();

    return resize.on('change', apply);
  }, [coverVector, frameHeight, frameWidth, photo, resize, shaderContext]);

  // The plane, created, added, and disposed in one effect so it survives
  // Strict Mode's remount (the Strict Mode gotcha in docs/agents/tsl.md).
  useEffect(() => {
    if (!shaderContext) return;

    // The texture uploads the photo to the GPU. Marking it sRGB tells three
    // to convert its colors to linear light when the shader reads them, the
    // space the output stage composes in.
    const map = new Texture(photo);

    map.colorSpace = SRGBColorSpace;
    map.needsUpdate = true;

    // uv() runs from 0 to 1 across the plane. Subtracting 0.5 measures it
    // from the center, scaling by the cover share shrinks it to the part of
    // the photo the canvas shows, and adding 0.5 moves it back, so the crop
    // stays centered. The cover share is a vec uniform, so it goes in as an
    // argument (the vec-uniform gotcha in docs/agents/tsl.md).
    const material = new MeshBasicNodeMaterial();

    material.colorNode = texture(map, uv().sub(0.5).mul(coverUniform).add(0.5));

    // A 2x2 plane exactly fills ShaderScene's camera view, -1 to 1 on both
    // axes, so the photo covers the whole canvas.
    const mesh = new Mesh(new PlaneGeometry(2, 2), material);

    shaderContext.scene.add(mesh);
    shaderContext.scheduler.requestRender();

    return () => {
      shaderContext.scene.remove(mesh);
      material.dispose();
      mesh.geometry.dispose();
      map.dispose();
    };
  }, [coverUniform, photo, shaderContext]);

  return null;
}

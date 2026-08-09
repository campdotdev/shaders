'use client';

// The Voronoi mosaic's GPU half. Each pixel finds its nearest scattered seed
// point (voronoiCells), takes that cell's stable random value, and picks a
// color from the ramp — every pixel in a cell lands on the same value, so
// cells render as flat patches. The wrapper (./voronoi.tsx) supplies props.
import { useEffect, useMemo } from 'react';

import { colorRamp, voronoiCells } from '@lovo/matter';
import {
  type AnimatableProp,
  useAnimatableUniform,
  useResize,
  useShaderContext,
  useStaticSceneHint,
} from '@lovo/matter-react';
import { uniform, uv, vec2 } from 'three/tsl';
import { Mesh, MeshBasicNodeMaterial, PlaneGeometry, Vector2 } from 'three/webgpu';

import { type ColorStop, colorStopsKey, toColorRampStops } from '../utils/color';

export interface VoronoiShaderProps {
  /**
   * Palette cells draw from. Each cell picks its color by a stable per-cell
   * random value mapped along this ramp. Accepts hex, `oklch()`, or
   * `oklab()`; positions auto-space when omitted.
   */
  stops: ColorStop[];
  /**
   * Cell density — roughly how many cells span the canvas height. Higher
   * values give a finer mosaic. Accepts a static value or an animation
   * signal.
   */
  scale: AnimatableProp<number>;
  /**
   * Static offset of the cell layout. Change it for a different arrangement
   * of the same character.
   */
  seed: number;
}

export function VoronoiShader({ stops, scale, seed }: VoronoiShaderProps) {
  const shaderContext = useShaderContext();

  // No animation until the motion phase lands — let the frame scheduler
  // idle instead of re-rendering a still image.
  useStaticSceneHint(true);

  const scaleUniform = useAnimatableUniform<number>(scale);

  // Content fingerprint of the stops array (colors + positions). The build
  // effect keys on this string, so a re-render that passes a new array with
  // the same contents doesn't rebuild the material.
  const stopsKey = colorStopsKey(stops);

  // The seed becomes a 2D offset of the sampling window (simplex-noise's
  // pattern): the classic 12.9898/78.233 hashing pair spreads consecutive
  // seeds to unrelated regions of the pattern instead of one cell apart.
  const seedVec = useMemo(() => new Vector2(0, 0), []);
  const seedUniform = useMemo(() => uniform(seedVec), [seedVec]);

  useEffect(() => {
    seedVec.set(seed * 12.9898, seed * 78.233);
    shaderContext?.scheduler.requestRender();
  }, [shaderContext, seedVec, seed]);

  // ---------------------------------------------
  // Track the canvas aspect ratio
  // ---------------------------------------------
  // Cells must stay roughly square on any canvas shape. The uniform starts
  // from the current canvas size (16:9 fallback while the canvas is
  // collapsed and reports 0), then follows every resize (vignette's
  // pattern).
  const resize = useResize();
  const [initialWidth, initialHeight] = resize.get();
  const aspectNode = useMemo(
    () => uniform(initialHeight > 0 ? initialWidth / initialHeight : 16 / 9),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    const [canvasWidth, canvasHeight] = resize.get();

    if (canvasWidth > 0 && canvasHeight > 0) aspectNode.value = canvasWidth / canvasHeight;

    return resize.on('change', ([updatedWidth, updatedHeight]) => {
      if (updatedWidth > 0 && updatedHeight > 0) aspectNode.value = updatedWidth / updatedHeight;
    });
  }, [resize, aspectNode]);

  // ---------------------------------------------
  // Build the material and mount the mesh
  // ---------------------------------------------
  // Runs once per mount — again only when the stops change, because
  // colorRamp bakes the stop colors into the compiled shader as constants.
  // Every dial rides uniforms without touching this effect.
  useEffect(
    () => {
      if (!shaderContext) return;

      // Where to sample the cell field. uv() is the pixel's 0..1 position;
      // centering before the aspect multiply keeps the pattern anchored to
      // the canvas middle, and scaling x by width/height keeps cells square
      // instead of stretched to the canvas shape. scale zooms (≈ cells per
      // canvas height); the seed offset slides the window to a different
      // neighborhood of the infinite pattern.
      const centered = uv().sub(0.5);
      const corrected = vec2(centered.x.mul(aspectNode), centered.y);
      const samplePoint = corrected.mul(scaleUniform).add(seedUniform);

      const cells = voronoiCells(samplePoint, { jitter: 1 });

      const material = new MeshBasicNodeMaterial();

      // Each cell's stable hash picks a point on the ramp: a flat color per
      // cell, because the hash is constant across the cell.
      material.colorNode = colorRamp(cells.hash, toColorRampStops(stops), 'oklab', 'shorter');

      const mesh = new Mesh(new PlaneGeometry(2, 2), material);

      shaderContext.scene.add(mesh);

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
    },
    // stopsKey is a stable string proxy for the stops array (identity-only
    // changes must not rebuild); uniforms are mutated in place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shaderContext, scaleUniform, seedUniform, aspectNode, stopsKey],
  );

  return null;
}

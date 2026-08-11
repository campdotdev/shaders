'use client';

// The Voronoi mosaic's GPU half. Each pixel finds its nearest scattered seed
// point (voronoiCells), takes that cell's stable random value, and picks a
// color from the ramp — every pixel in a cell lands on the same value, so
// cells render as flat patches. The wrapper (./voronoi.tsx) supplies props.
import { useEffect, useMemo } from 'react';

import {
  colorRamp,
  type ColorSpace,
  type HueInterpolation,
  mixColor,
  quantize,
  timelineWander,
  voronoiCells,
} from '@lovo/matter';
import {
  type AnimatableProp,
  useAnimatableSpeed,
  useAnimatableUniform,
  useResize,
  useShaderContext,
  useStaticSceneHint,
} from '@lovo/matter-react';
import {
  clamp,
  float,
  fwidth,
  mix,
  pow,
  select,
  smoothstep,
  uint,
  uniform,
  uv,
  vec2,
} from 'three/tsl';
import { Mesh, MeshBasicNodeMaterial, PlaneGeometry, Vector2, Vector3 } from 'three/webgpu';

import { type ColorStop, colorStopsKey, parseColor, toColorRampStops } from '../utils/color';

export interface VoronoiTuning {
  /** Border gap at borderWidth 1, in pattern units. Up = chunkier mortar. */
  maxBorderGap?: number;
  /** Feather width at borderSoftness 1, in pattern units. Up = mistier. */
  maxBorderSoftness?: number;
  /** Scales how quickly shading deepens away from borders. Up = full depth nearer the edge. */
  shadingRange?: number;
  /** Scales how far the glow tint reaches in from borders. Up = tighter halo. */
  glowRange?: number;
  /** Falloff shape of the glow. Up = light gathers against the borders. */
  glowExponent?: number;
  /** Brightness multiplier on the glow light. Dark palettes need > 1 to read. */
  glowGain?: number;
  /** How often the field picks a new heading, in retargets per phase unit. */
  flowRate?: number;
  /** How far the field sloshes from center, in cells. 0 (default) pins it. */
  flowRange?: number;
}

export interface VoronoiShaderProps {
  /**
   * Palette cells draw from. Each cell picks its color by a stable per-cell
   * random value mapped along this ramp. Accepts hex, `oklch()`, or
   * `oklab()`; positions auto-space when omitted.
   */
  stops: ColorStop[];
  /**
   * Posterize the palette. 0 is continuous — every cell a unique shade; 1
   * snaps every cell to exactly the stop colors; higher values add that
   * many minus one evenly spaced blends between each neighboring pair of
   * stops. Accepts a static value or an animation signal.
   */
  steps: AnimatableProp<number>;
  /**
   * Depth inside each cell, following its shape: slides colors along the
   * ramp around the cell's own color, toward the ramp's start at the
   * borders and its end in the interior. 0 is flat; 1 sweeps half the ramp
   * each way. Accepts a static value or an animation signal.
   */
  shading: AnimatableProp<number>;
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
  /**
   * How fast cells drift over time. 0 freezes the pattern. Accepts a
   * static value or an animation signal.
   */
  speed: AnimatableProp<number>;
  /**
   * How far seeds scatter off a perfect grid. 0 arranges cells in an exact
   * square grid; 1 is fully organic. Static — motion is governed by `drift`
   * and `speed`. Accepts a static value or an animation signal.
   */
  irregularity: AnimatableProp<number>;
  /**
   * How far cells wobble around their home positions while animating. 0
   * pins them in place even at high speed; 1 lets each seed roam all the
   * room its cell offers, so walls slide and cells reshape. Accepts a
   * static value or an animation signal.
   */
  drift: AnimatableProp<number>;
  /** Color of the border lines between cells. */
  borderColor: string;
  /**
   * Width of the border between cells. 0 removes borders entirely (cells
   * touch seamlessly); 1 is chunky mortar. Accepts a static value or an
   * animation signal.
   */
  borderWidth: AnimatableProp<number>;
  /**
   * How soft the border edge is. 0 is a crisp anti-aliased line; 1 fades
   * the border into the cells as a wide mist. Accepts a static value or an
   * animation signal.
   */
  borderSoftness: AnimatableProp<number>;
  /**
   * Light each cell casts inward from its borders, in the cell's own
   * color — an additive halo hugging the cell shape, like backlit glass.
   * 0 disables it. Accepts a static value or an animation signal.
   */
  glow: AnimatableProp<number>;
  /** Color space the ramp and border/glow mixes interpolate in. */
  colorSpace: ColorSpace;
  /**
   * Hue arc for cylindrical color spaces (oklch/lch/hsl/hsv); inert
   * otherwise.
   */
  hueInterpolation: HueInterpolation;
  /**
   * TEMPORARY dev-tuning overrides for feel constants. Stripped before
   * release — do not use.
   */
  tuning?: VoronoiTuning;
}

export function VoronoiShader({
  stops,
  steps,
  shading,
  scale,
  seed,
  speed,
  irregularity,
  drift,
  borderColor,
  borderWidth,
  borderSoftness,
  glow,
  colorSpace,
  hueInterpolation,
  tuning,
}: VoronoiShaderProps) {
  const shaderContext = useShaderContext();

  // A literal speed of 0 freezes the pattern, so nothing ever changes on
  // screen (an animation signal might move later and doesn't count). Telling
  // the scene lets its frame scheduler go idle instead of re-rendering.
  const isStatic = typeof speed === 'number' && speed === 0;

  useStaticSceneHint(isStatic);

  const scaleUniform = useAnimatableUniform<number>(scale);

  // The animated dials live in uniforms (values the CPU can update each
  // frame without rebuilding the shader). Speed is the exception:
  // useAnimatableSpeed integrates it into a phase uniform (speed × delta
  // summed each frame), so a speed change shifts the drift tempo without
  // snapping every cell to a new position.
  const phaseUniform = useAnimatableSpeed(speed);
  const irregularityUniform = useAnimatableUniform<number>(irregularity);
  const driftUniform = useAnimatableUniform<number>(drift);
  const stepsUniform = useAnimatableUniform<number>(steps);
  const shadingUniform = useAnimatableUniform<number>(shading);

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

  // The border color rides a Vector3 uniform (vignette's pattern): the
  // Vector3 and its uniform are created once, the effect writes decoded rgb
  // into them, so a color change never rebuilds the material.
  const borderColorVec = useMemo(() => new Vector3(0, 0, 0), []);
  const borderColorUniform = useMemo(() => uniform(borderColorVec), [borderColorVec]);

  useEffect(() => {
    const [red, green, blue] = parseColor(borderColor);

    borderColorVec.set(red, green, blue);
    shaderContext?.scheduler.requestRender();
  }, [shaderContext, borderColorVec, borderColor]);

  const borderWidthUniform = useAnimatableUniform<number>(borderWidth);
  const borderSoftnessUniform = useAnimatableUniform<number>(borderSoftness);
  const glowUniform = useAnimatableUniform<number>(glow);

  // ---------------------------------------------
  // Tuning (dev) — stripped at the defaults gate
  // ---------------------------------------------
  // Feel constants ride uniforms so the panel's tuning sliders glide
  // without rebuilding the material.
  const maxBorderGapUniform = useMemo(() => uniform(0.1), []);
  const maxBorderSoftnessUniform = useMemo(() => uniform(0.1), []);
  const flowRateUniform = useMemo(() => uniform(0.3), []);
  const flowRangeUniform = useMemo(() => uniform(0), []);
  const shadingRangeUniform = useMemo(() => uniform(2.5), []);
  const glowRangeUniform = useMemo(() => uniform(2.5), []);
  const glowExponentUniform = useMemo(() => uniform(1.5), []);
  const glowGainUniform = useMemo(() => uniform(2.5), []);

  useEffect(() => {
    maxBorderGapUniform.value = tuning?.maxBorderGap ?? 0.1;
    maxBorderSoftnessUniform.value = tuning?.maxBorderSoftness ?? 0.1;
    flowRateUniform.value = tuning?.flowRate ?? 0.3;
    flowRangeUniform.value = tuning?.flowRange ?? 0;
    shadingRangeUniform.value = tuning?.shadingRange ?? 2.5;
    glowRangeUniform.value = tuning?.glowRange ?? 2.5;
    glowExponentUniform.value = tuning?.glowExponent ?? 1.5;
    glowGainUniform.value = tuning?.glowGain ?? 2.5;
    shaderContext?.scheduler.requestRender();
  }, [
    shaderContext,
    maxBorderGapUniform,
    maxBorderSoftnessUniform,
    flowRateUniform,
    flowRangeUniform,
    shadingRangeUniform,
    glowRangeUniform,
    glowExponentUniform,
    glowGainUniform,
    tuning,
  ]);

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

      // Meandering flow: the sampling window's offset follows two slow
      // timelineWander trajectories (one per axis) instead of a straight
      // line, so the whole field sloshes a few cells in ever-changing
      // directions — travel with no destination and no fixed heading (a
      // linear conveyor read as mechanical). Each axis layers two detuned
      // octaves (rates 1 : 2.7) to erase the retargeting cadence. The same
      // integrated phase that clocks the cell wander drives it, so one
      // speed dial governs both; flowRange is the slosh radius in cells.
      const flowTimeline = phaseUniform.mul(flowRateUniform).add(1024);
      const flowTimelineFast = flowTimeline.mul(2.7);
      const flowSeed = uint(0x9e3779b9);
      const flowAxis = (salt: number) =>
        timelineWander(flowSeed, salt, flowTimeline)
          .mul(0.7)
          .add(timelineWander(flowSeed, salt + 7919, flowTimelineFast).mul(0.3));
      const flow = vec2(flowAxis(101), flowAxis(211)).mul(flowRangeUniform);
      const samplePoint = corrected.mul(scaleUniform).add(seedUniform).add(flow);

      // The accumulated phase drives the wobble clock; irregularity feeds
      // the primitive's jitter (static scatter) and drift its headroom
      // fraction — at 1, each seed roams all the room its cell offers (the
      // primitive keeps seeds in-cell by construction, so there is no
      // amplitude ceiling to tune).
      const cells = voronoiCells(samplePoint, {
        time: phaseUniform,
        jitter: irregularityUniform,
        drift: driftUniform,
      });

      const material = new MeshBasicNodeMaterial();

      // ---------------------------------------------
      // Cell color: hash → (snap) → (shade) → ramp
      // ---------------------------------------------
      // steps posterizes PER PALETTE SEGMENT (Paper Shaders' stepsPerColor
      // semantics): the quantize level count is steps × segments + 1, so
      // with auto-spaced stops the palette colors themselves are always
      // among the levels — steps 1 is exactly the stop colors, 2 adds one
      // blend between each neighboring pair, and so on. Counting raw ramp
      // levels instead made the dial lie: most counts landed between stops
      // and produced off-palette blends. The select gates steps 0 (and the
      // fractional approach to it) back to the raw hash — the continuous
      // "every cell unique" look the 0 default promises.
      const segmentCount = Math.max(stops.length - 1, 1);
      const levelCount = stepsUniform.mul(segmentCount).add(1);
      const snapped = quantize(cells.hash, levelCount);
      const cellValue = select(stepsUniform.greaterThan(0.5), snapped, cells.hash);

      // Shading slides each pixel ALONG the ramp around its own cell's
      // color, by distance to the nearest BORDER — depth that hugs each
      // cell's polygonal shape (an inset, like glass thickening toward the
      // middle) rather than the circular rings that seed-distance shading
      // produces. Centering (−0.5 shift) holds the cell's base color at
      // mid-depth: border side slides toward the ramp's start, interior
      // toward its end, for a dark→light palette. Offsetting the ramp
      // INPUT (never crossfading toward a shared value) keeps every cell's
      // identity at full shading — and every in-between color on the ramp
      // itself. shadingRange calibrates the reach: interiors top out around
      // 0.4 pattern units from a border, so ~2.5 maps a deep interior to
      // the sweep's end.
      const borderDepth = clamp(cells.edgeDistance.mul(shadingRangeUniform), 0, 1);
      const radialShift = borderDepth.sub(0.5).mul(shadingUniform);
      const rampInput = clamp(cellValue.add(radialShift), 0, 1);

      const cellColor = colorRamp(rampInput, toColorRampStops(stops), colorSpace, hueInterpolation);

      // ---------------------------------------------
      // Borders: constant-width lines along cell edges
      // ---------------------------------------------
      // edgeDistance is 0 exactly on a border and grows toward each cell's
      // interior, so thresholding it at `gap` draws lines of equal width
      // everywhere. The threshold is softened by two bands: an anti-aliasing
      // floor from fwidth() (a screen-space derivative — how much
      // edgeDistance changes across one screen pixel), which keeps the line
      // crisp but unjagged at any zoom, plus the softness dial's wider
      // feather on top.
      const gap = borderWidthUniform.mul(maxBorderGapUniform);
      const band = fwidth(cells.edgeDistance).add(
        borderSoftnessUniform.mul(maxBorderSoftnessUniform),
      );
      const cellMask = smoothstep(gap.sub(band), gap.add(band), cells.edgeDistance);

      // At width 0 the smoothstep would still tint the half-pixel sitting
      // exactly on each edge (edgeDistance 0 lands mid-band), reading as a
      // faint seam. Fade the border out entirely as width approaches 0.
      const borderStrength = smoothstep(0.0, 0.002, borderWidthUniform);
      const borderMask = mix(float(1), cellMask, borderStrength);

      // The border blend interpolates in the user's chosen space (mixColor)
      // rather than raw linear RGB, so mid-blend colors stay on a
      // perceptually sensible path.
      const strokedColor = mixColor(
        borderColorUniform,
        cellColor,
        borderMask,
        colorSpace,
        hueInterpolation,
      );

      // ---------------------------------------------
      // Glow: each cell casts its own light — over the leading
      // ---------------------------------------------
      // A real glow is ADDITIVE — light lands on top of the surface in
      // linear space rather than mixing toward a color (a mix can only
      // stay inside the two endpoints; addition can push past 1 and clip
      // bright, which is what reads as luminous). It applies LAST, after
      // the border stroke, so the light washes over the leading where the
      // mask peaks — light spilling across the seams, the bloom cue
      // backlit glass actually has. The light source is the cell's BASE
      // color (the pre-shading ramp lookup): near borders the shaded
      // surface is dark, and dark × anything stays dark, so the glow must
      // bring the cell's identity color with it. The mask is 1 at a
      // border and fades inward over 1/glowRange pattern units; pow()
      // shapes the falloff — higher exponents gather the light against
      // the borders (and keep the leading crisper under the wash).
      // glowGain scales the light in linear space — hue-preserving
      // brightening; dark palette stops are tiny in linear terms (~0.05),
      // so 1x of their own color barely registers as light.
      const baseCellColor = colorRamp(
        cellValue,
        toColorRampStops(stops),
        colorSpace,
        hueInterpolation,
      );
      const glowMask = pow(
        clamp(cells.edgeDistance.mul(glowRangeUniform), 0, 1).oneMinus(),
        glowExponentUniform,
      );

      material.colorNode = strokedColor.add(
        baseCellColor.mul(glowUniform.mul(glowMask).mul(glowGainUniform)),
      );

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
    [
      shaderContext,
      scaleUniform,
      seedUniform,
      aspectNode,
      stopsKey,
      phaseUniform,
      irregularityUniform,
      driftUniform,
      stepsUniform,
      shadingUniform,
      shadingRangeUniform,
      borderColorUniform,
      borderWidthUniform,
      borderSoftnessUniform,
      glowUniform,
      glowRangeUniform,
      glowExponentUniform,
      glowGainUniform,
      maxBorderGapUniform,
      maxBorderSoftnessUniform,
      flowRateUniform,
      flowRangeUniform,
      colorSpace,
      hueInterpolation,
    ],
  );

  return null;
}

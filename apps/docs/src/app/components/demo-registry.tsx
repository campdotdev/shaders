/**
 * Maps a component slug to the pieces the shared components/[slug] template
 * cannot derive from the catalog (registry.json): the client demo island and
 * the Usage content. The template renders usageNotes above the snippet, so
 * notes read as guidance introducing the code. Paragraphs that merely
 * restated the catalog description were dropped when pages converted — the
 * template's header already shows it.
 */
import type { ComponentType, ReactNode } from 'react';

import { AuroraIsland } from './aurora/demo';
import { BlobsIsland } from './blobs/demo';
import { ConicGradientIsland } from './conic-gradient/demo';
import { DitherIsland } from './dither/demo';
import { DotFieldIsland } from './dot-field/demo';
import { FractalNoiseIsland } from './fractal-noise/demo';
import { GodRaysIsland } from './god-rays/demo';
import { GrainIsland } from './grain/demo';
import { LinearGradientIsland } from './linear-gradient/demo';
import { MeshGradientIsland } from './mesh-gradient/demo';
import { RadialGradientIsland } from './radial-gradient/demo';
import { SimplexNoiseIsland } from './simplex-noise/demo';
import { VignetteIsland } from './vignette/demo';
import { VoronoiIsland } from './voronoi/demo';
import { WaveLinesIsland } from './wave-lines/demo';

export interface ComponentPageEntry {
  /** Client island rendering the control store, shader demo, and control panel. */
  Island: ComponentType;
  /** Code snippet for the Usage section, rendered verbatim in a <pre>. */
  usageSnippet: string;
  /**
   * Optional prose above the snippet. Single-paragraph notes are bare
   * content; multi-paragraph notes bring their own <p> tags.
   */
  usageNotes?: ReactNode;
}

export const COMPONENT_PAGES: Record<string, ComponentPageEntry> = {
  aurora: {
    Island: AuroraIsland,
    usageSnippet: `<ShaderScene>
  <Aurora intensity={1} stops={[...]} />
</ShaderScene>`,
    usageNotes: (
      <>
        The aurora fills its scene; compose with the container. For a curtain band hanging in a wide
        dark sky, place a short ShaderScene near the top of a taller dark section.{' '}
        <code>coverage</code> reveals the curtain from the bottom up — 1 covers the canvas, 0 hides
        it.
      </>
    ),
  },
  blobs: {
    Island: BlobsIsland,
    usageSnippet: `<ShaderScene>
  <LinearGradient />
  <Blobs />
</ShaderScene>`,
    usageNotes: (
      <>
        The space between blobs is transparent — stack Blobs over a gradient or any other layer and
        it shows through.
      </>
    ),
  },
  'conic-gradient': {
    Island: ConicGradientIsland,
    usageSnippet: `<ShaderScene>
  <ConicGradient />
</ShaderScene>`,
  },
  dither: {
    Island: DitherIsland,
    usageSnippet: `<ShaderScene>
  <MeshGradient />
  <Dither pattern="bayer-8x8" pixelSize={4} levels={4} />
</ShaderScene>`,
    usageNotes: (
      <>
        <p>
          Dither is a post-process layer: stack it after any components inside a{' '}
          <code>&lt;ShaderScene&gt;</code> and it pixelates the composed scene into chunky cells,
          posterizing each channel to a few levels — the scene keeps its own colors.
        </p>
        <p>
          <code>pattern</code> picks the threshold map that decides how in-between colors resolve:
          the Bayer matrices trade smoothness (8x8) for crunch (2x2). <code>pixelSize</code> sets
          the cell size in CSS pixels, and <code>levels</code> is how many steps each color channel
          is allowed — <code>2</code> is the harshest look, <code>6</code> and up reads as subtle
          banding. <code>spread</code> dials the pattern&apos;s strength from clean posterize bands
          (<code>0</code>) to gritty overshoot (<code>2</code>), and <code>threshold</code> gates
          the effect by brightness — slide it down to release the highlights until the effect is
          gone.
        </p>
      </>
    ),
  },
  'dot-field': {
    Island: DotFieldIsland,
    usageSnippet: `<ShaderScene>
  <DotField spacing={30} dotSize={3} color="oklch(0.65 0.01 150)" speed={0.45} amplitude={0.15} />
</ShaderScene>`,
  },
  'fractal-noise': {
    Island: FractalNoiseIsland,
    usageSnippet: `<ShaderScene>
  <FractalNoise />
</ShaderScene>`,
  },
  'god-rays': {
    Island: GodRaysIsland,
    usageSnippet: `<ShaderScene>
  <GodRays center={[0.5, -0.05]} />
</ShaderScene>`,
    usageNotes: (
      <>
        Light rays radiate from <code>center</code> — park it off-canvas for a top-of-page sun. The
        rays emit over a transparent background; stack them above a dark layer.
      </>
    ),
  },
  grain: {
    Island: GrainIsland,
    usageSnippet: `<ShaderScene>
  <LinearGradient />
  <Grain intensity={0.45} speed={1} blend="additive" />
</ShaderScene>`,
    usageNotes: (
      <>
        <p>
          Grain stacks inside any <code>&lt;ShaderScene&gt;</code> on top of whatever base component
          you want — gradients, noise fields, mesh gradients — and applies a layer of animated grain
          via the post-processing pipeline.
        </p>
        <p>
          <strong>Additive</strong> (default) adds signed grain so half the pixels brighten and half
          darken, preserving average exposure — pure texture, no exposure shift.{' '}
          <strong>Subtractive</strong> takes the absolute value of the grain and subtracts it, so
          the image only darkens. Subtractive simulates silver-halide film stock physics, where
          exposed grain blocks light.
        </p>
        <p>
          <code>speed</code> controls the shutter cadence: <code>1</code> ≈ 60Hz (continuous shimmer
          at 60fps), <code>0.4</code> ≈ 24Hz (chunky film cadence), <code>0</code> freezes the grain
          pattern.
        </p>
      </>
    ),
  },
  'linear-gradient': {
    Island: LinearGradientIsland,
    usageSnippet: `<ShaderScene>
  <LinearGradient />
</ShaderScene>`,
  },
  'mesh-gradient': {
    Island: MeshGradientIsland,
    usageSnippet: `<ShaderScene>
  <MeshGradient />
</ShaderScene>`,
  },
  'radial-gradient': {
    Island: RadialGradientIsland,
    usageSnippet: `<ShaderScene>
  <RadialGradient />
</ShaderScene>`,
  },
  'simplex-noise': {
    Island: SimplexNoiseIsland,
    usageSnippet: `import { ShaderScene } from '@camp-dev/shaders-react'
import { SimplexNoise } from '@/components/shaders/simplex-noise'

<ShaderScene>
  <SimplexNoise />
</ShaderScene>`,
  },
  vignette: {
    Island: VignetteIsland,
    usageSnippet: `<ShaderScene>
  <LinearGradient />
  <Vignette intensity={0.5} radius={0.6} feather={0.5} />
</ShaderScene>`,
    usageNotes: (
      <>
        <p>
          Vignette stacks inside any <code>&lt;ShaderScene&gt;</code> on top of whatever base
          component you want and fades the upstream pixels toward an edge color along a soft radial
          ring. Unlike <code>&lt;Grain /&gt;</code>, which generates new noise from <code>uv</code>,
          Vignette reads the upstream pixel and mixes it toward <code>color</code> — the{' '}
          {`"read-upstream"`} half of the post-processing pipeline.
        </p>
        <p>
          <code>feather</code> controls how gradual the blend is. At <code>0</code> the ring is a
          hard cutoff; at <code>1</code> the entire canvas is in the blend (a smooth radial gradient
          from center to edge). <code>radius</code> is the outer edge of the ring;{' '}
          <code>center</code> is the bright spot in normalized UV space.
        </p>
      </>
    ),
  },
  voronoi: {
    Island: VoronoiIsland,
    usageSnippet: `<ShaderScene>
  <Voronoi />
</ShaderScene>`,
  },
  'wave-lines': {
    Island: WaveLinesIsland,
    // The legacy page showed a live snippet mirroring the control panel; see
    // the note in wave-lines/demo.tsx for why it is static here for now.
    usageSnippet: `<ShaderScene>
  <WaveLines />
</ShaderScene>`,
  },
};

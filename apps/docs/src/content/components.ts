/**
 * One line of description and one taxonomy category per Tier 1 component.
 * This is the docs' own record: the package ships no manifest, and the
 * sidebar, the components index, search, and page order all derive from
 * these two fields plus the slug. The slug doubles as the URL segment and as
 * the folder name under packages/shaders/src/components, which props.ts reads.
 */
import type { CategorySlug } from './taxonomy';

export interface ComponentMeta {
  description: string;
  category: CategorySlug;
  /**
   * Sidebar and page label, when the prettified slug gets an acronym wrong.
   * Absent for every component whose slug prettifies correctly.
   */
  label?: string;
}

export const COMPONENTS = {
  aurora: {
    description:
      'Four color-seeded noise curtains sharing one atmospheric noise field, layered over a dusk sky.',
    category: 'scenes',
  },
  blobs: {
    description:
      'Soft gooey blobs. Colored metaballs drifting around the center, merging and splitting over a transparent background.',
    category: 'scenes',
  },
  'conic-gradient': {
    description:
      'A color ramp sweeping clockwise around a center point, with pinwheel repeats and rotation. Completes the CSS gradient trio with LinearGradient and RadialGradient.',
    category: 'gradients',
  },
  dither: {
    description:
      'Retro ordered dithering: pixelates the scene into chunky cells and posterizes its colors. Stacks on top of any base component inside <ShaderScene>.',
    category: 'retro-glitch',
  },
  dissolve: {
    description:
      'Turns the scene into grain, shown block by block as progress rises. Stacked after a feathered wipe, it grains the soft edge into a ragged one. Stacks on top of any base component inside <ShaderScene>.',
    category: 'transitions',
  },
  'dot-field': {
    description:
      'Tiled dot field with center-anchored ripple displacement. The architecturally-validating Shaders component.',
    category: 'patterns',
  },
  'fractal-noise': {
    description:
      'Layered fractal noise. Multi-octave texture with a style dial from soft clouds to crisp vein networks.',
    category: 'noise',
  },
  'god-rays': {
    description:
      'Layered soft light rays radiating from a controllable origin: two flowing noise fields multiplied per color, with patchiness, diffusion, and an interactive source glow.',
    category: 'scenes',
  },
  grain: {
    description:
      'Additive or subtractive film grain overlay. Stacks on top of any base component inside <ShaderScene>.',
    category: 'lens-film',
  },
  'led-wall': {
    description:
      'Screens the scene into a wall of square LED dots, each lit with the color beneath it, with a per-dot flicker and a swell that follows the cursor. Stacks on top of any base component inside <ShaderScene>.',
    category: 'retro-glitch',
    label: 'LED Wall',
  },
  'linear-gradient': {
    description: 'Animated linear gradient. The simplest, foundational Shaders component.',
    category: 'gradients',
  },
  'mesh-gradient': {
    description:
      'Warped 4-color fluid gradient with time-cycling palette and film grain. Linear/Stripe marketing-page style.',
    category: 'gradients',
  },
  'radial-gradient': {
    description:
      'A color ramp radiating from a point, with an elliptical shape control and repeating concentric rings. The radial counterpart to LinearGradient.',
    category: 'gradients',
  },
  'radial-wipe': {
    description:
      'Reveals or hides the scene from a point with a feathered edge. Stack a Dissolve after it to grain that edge. Stacks on top of any base component inside <ShaderScene>.',
    category: 'transitions',
  },
  'simplex-noise': {
    description:
      'Evolving 3D simplex noise with color ramp, contour bands, and brightness/contrast histogram shaping.',
    category: 'noise',
  },
  vignette: {
    description:
      'Radial darkening at the canvas edges. Stacks on top of any base component inside <ShaderScene>.',
    category: 'lens-film',
  },
  voronoi: {
    description:
      'Cellular mosaic. Flat color patches around drifting seed points, with crisp constant-width borders.',
    category: 'noise',
  },
  'wave-lines': {
    description:
      'Coherent wave-line bundle: translucent ribbon bodies wrapped in additive halo light. Lines share one wave and braid, breathe, and fray wide toward the canvas edges, with per-line flat or gradient color.',
    category: 'scenes',
  },
} satisfies Record<string, ComponentMeta>;

/**
 * Composition 1, Reeded glass (SHA-292): slow color drifting behind a pane of
 * fluted glass, with the pointer pulling the color. CursorSmudge sits under
 * FlutedGlass, so the glass bends the smeared color.
 */
import { defineComposition } from '../define';

export const reededGlass = defineComposition({
  slug: 'reeded-glass',
  title: 'Reeded glass',
  description:
    'Slow color drifting behind a pane of fluted glass. Drag across it to pull the color.',
  defaultPresetName: 'Dusk',
  stack: [
    // Plum to rose to apricot: 60° of hue, with depth carried by lightness.
    {
      id: 'gradient',
      component: 'LiquidGradient',
      props: {
        angle: 20,
        speed: 0.12,
        stops: [
          { color: 'oklch(0.30 0.11 345)' },
          { color: 'oklch(0.52 0.17 15)' },
          { color: 'oklch(0.76 0.14 45)' },
        ],
        swirl: 1.1,
      },
    },
    // A slightly wider, weaker brush than the default, which eases back a
    // little slower.
    { id: 'smudge', component: 'CursorSmudge', props: { decay: 0.35, radius: 0.2, strength: 0.1 } },
    // Flutes widened from 30 to 44 CSS px for a hero-sized canvas, with a
    // little more fringing, wall highlight, and groove shadow than the defaults.
    {
      id: 'glass',
      component: 'FlutedGlass',
      props: { dispersion: 0.25, fluteWidth: 44, highlight: 0.2, shadow: 0.25 },
    },
    { id: 'grain', component: 'Grain', props: { intensity: 0.06 } },
    { id: 'vignette', component: 'Vignette', props: { intensity: 0.35 } },
  ],
  presets: [
    {
      // Cool, wide, soft panes: bottle glass worn smooth.
      name: 'Sea glass',
      props: {
        gradient: {
          stops: [
            { color: 'oklch(0.32 0.08 200)' },
            { color: 'oklch(0.55 0.11 175)' },
            { color: 'oklch(0.80 0.10 150)' },
          ],
          swirl: 0.8,
        },
        glass: { dispersion: 0.15, fluteWidth: 64, highlight: 0.3, refraction: 0.8 },
      },
    },
    {
      // Hot and sharp: narrow prism ribs that split the color hard.
      name: 'Ember',
      props: {
        gradient: {
          speed: 0.18,
          stops: [
            { color: 'oklch(0.28 0.12 25)' },
            { color: 'oklch(0.55 0.16 50)' },
            { color: 'oklch(0.82 0.15 80)' },
          ],
          swirl: 1.4,
        },
        glass: { crossSection: 'prism', dispersion: 0.4, fluteWidth: 28 },
        vignette: { intensity: 0.45 },
      },
    },
    {
      // Near-neutral and slow: horizontal flat-topped ribs over smoke.
      name: 'Graphite',
      props: {
        gradient: {
          speed: 0.08,
          stops: [
            { color: 'oklch(0.18 0.01 260)' },
            { color: 'oklch(0.42 0.015 260)' },
            { color: 'oklch(0.78 0.01 260)' },
          ],
        },
        glass: { angle: 0, crossSection: 'flat', dispersion: 0, highlight: 0.3, shadow: 0.35 },
        grain: { intensity: 0.08 },
      },
    },
  ],
  controls: [
    { kind: 'color', entry: 'gradient', path: 'stops.0.color', label: 'Shadow' },
    { kind: 'color', entry: 'gradient', path: 'stops.1.color', label: 'Middle' },
    { kind: 'color', entry: 'gradient', path: 'stops.2.color', label: 'Light' },
    {
      kind: 'slider',
      entry: 'gradient',
      path: 'speed',
      label: 'Drift',
      min: 0,
      max: 0.5,
      step: 0.01,
    },
    {
      kind: 'slider',
      entry: 'gradient',
      path: 'swirl',
      label: 'Swirl',
      min: 0,
      max: 2,
      step: 0.01,
    },
    {
      kind: 'slider',
      entry: 'glass',
      path: 'fluteWidth',
      label: 'Flute width',
      min: 12,
      max: 120,
      step: 1,
    },
    // 0 is prism, 0.5 round, and 1 flat. The store seeds the names to these.
    {
      kind: 'slider',
      entry: 'glass',
      path: 'crossSection',
      label: 'Glass shape',
      min: 0,
      max: 1,
      step: 0.01,
    },
    {
      kind: 'slider',
      entry: 'glass',
      path: 'dispersion',
      label: 'Color split',
      min: 0,
      max: 0.6,
      step: 0.01,
    },
  ],
});

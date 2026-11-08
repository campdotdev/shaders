/**
 * Composition 2, Bit comet (SHA-313): a slow heat field on a wall of square
 * cells, mapped onto a few flat colors with scattered cells at each band's
 * edge. The pointer heats the cells under it and leaves a tail that cools
 * back through the palette. CursorTrail and PaletteMap are resamples, so they
 * nest inside LedWall's cell snap and each runs once per cell, at its center.
 */
import { defineComposition } from '../define';

export const bitComet = defineComposition({
  slug: 'bit-comet',
  title: 'Bit comet',
  description:
    'A heat map on a wall of square pixels. Move across it and a comet of hot cells trails the pointer.',
  defaultPresetName: 'Risograph',
  stack: [
    // The heat field, as a gray value that PaletteMap turns into color.
    // contrast spreads the noise wide enough to reach every palette color.
    // The ramp stops at the edge of the hottest color's band, so the dither
    // gives the field at most half its cells in that color, scattered, and a
    // solid patch of it is always the pointer. The edge sits at
    // (n - 1.5) / (n - 1) for n colors: 0.833 for
    // these four, and the six-color presets set their own. angle and stretch
    // draw the patches out a little, up to the right at 45°. speed 0.05 is a
    // slow drift, a quarter of the default.
    {
      id: 'field',
      component: 'FractalNoise',
      props: {
        angle: 45,
        balance: 0.5,
        contrast: 3,
        detail: 0.45,
        octaves: 6,
        scale: 4,
        speed: 0.05,
        stops: [
          { color: 'oklch(0 0 0)' },
          { color: 'oklch(0.833 0 0)', position: 0.833 },
          { color: 'oklch(0.833 0 0)' },
        ],
        stretch: 1.5,
      },
    },
    // The pointer's heat, added to the field's value before the palette map,
    // so the spot and its tail take the same palette and dither. intensity
    // 1.2 pushes the comet's center past the hottest band's edge, so it draws
    // a solid core of the hottest color, ringed by every color between it
    // and the cells beneath. radius 0.1 of the hero's 696 px reaches about
    // 70 px. decay 0.2 keeps the tail short, so the comet reads as one spot,
    // and a still pointer holds it.
    {
      id: 'trail',
      component: 'CursorTrail',
      props: { decay: 0.2, hold: true, intensity: 1.2, radius: 0.1 },
    },
    // Risograph inks, cold to hot: off-white paper, blue, fluorescent pink,
    // then yellow. One color per 8 CSS px cell, matched to the wall's
    // spacing, so each dot takes one color. spread 1 scatters the two colors
    // at each band edge across the whole step between them.
    {
      id: 'palette',
      component: 'PaletteMap',
      props: {
        colors: [
          'oklch(0.97 0.01 90)',
          'oklch(0.45 0.17 265)',
          'oklch(0.68 0.24 0)',
          'oklch(0.88 0.17 95)',
        ],
        pixelSize: 8,
        spread: 1,
      },
    },
    // Square 7 px dots on an 8 px pitch, with white 1 px gutters and none of
    // LedWall's motion or per-dot variation. bleed 0.3 lets a little of each
    // cell's color into the gutters around it.
    {
      id: 'wall',
      component: 'LedWall',
      props: {
        bleed: 0.3,
        dotSize: 7,
        flicker: 0,
        panelColor: 'oklch(1 0 0)',
        spacing: 8,
        swell: 0,
        variation: 0,
      },
    },
  ],
  presets: [
    {
      // The reference's six colors, cold to hot: white, navy, blue, amber,
      // lime, then a red core. The cold end is a near-white beside the white
      // gutters.
      // Six colors put the hottest band's edge at 0.9.
      name: 'Thermal',
      props: {
        field: {
          stops: [
            { color: 'oklch(0 0 0)' },
            { color: 'oklch(0.9 0 0)', position: 0.9 },
            { color: 'oklch(0.9 0 0)' },
          ],
        },
        palette: {
          colors: [
            'oklch(0.99 0 0)',
            'oklch(0.26 0.039 271)',
            'oklch(0.54 0.18 270)',
            'oklch(0.82 0.158 85)',
            'oklch(0.92 0.215 120)',
            'oklch(0.61 0.195 31)',
          ],
        },
      },
    },
    {
      // A thermal camera at night: black cold, through violet and magenta,
      // to a yellow-white core, on black gutters.
      name: 'Infrared',
      props: {
        field: {
          stops: [
            { color: 'oklch(0 0 0)' },
            { color: 'oklch(0.9 0 0)', position: 0.9 },
            { color: 'oklch(0.9 0 0)' },
          ],
        },
        palette: {
          colors: [
            'oklch(0.12 0.02 280)',
            'oklch(0.30 0.14 290)',
            'oklch(0.50 0.22 340)',
            'oklch(0.68 0.20 30)',
            'oklch(0.84 0.17 75)',
            'oklch(0.97 0.08 100)',
          ],
        },
        wall: { panelColor: 'oklch(0 0 0)' },
      },
    },
    {
      // Four grays of ink and no color at all, on finer 6 px cells. The
      // palette's cells shrink with the wall's spacing, so each dot still
      // takes one color.
      name: 'Newsprint',
      props: {
        palette: {
          colors: ['oklch(0.99 0 0)', 'oklch(0.80 0 0)', 'oklch(0.50 0 0)', 'oklch(0.18 0 0)'],
          pixelSize: 6,
        },
        wall: { dotSize: 5, spacing: 6 },
      },
    },
  ],
  // Color 5 and 6 mount only on the six-color presets, since a control whose
  // path a preset lacks stays hidden.
  controls: [
    { kind: 'color', entry: 'palette', path: 'colors.0', label: 'Color 1' },
    { kind: 'color', entry: 'palette', path: 'colors.1', label: 'Color 2' },
    { kind: 'color', entry: 'palette', path: 'colors.2', label: 'Color 3' },
    { kind: 'color', entry: 'palette', path: 'colors.3', label: 'Color 4' },
    { kind: 'color', entry: 'palette', path: 'colors.4', label: 'Color 5' },
    { kind: 'color', entry: 'palette', path: 'colors.5', label: 'Color 6' },
    {
      kind: 'slider',
      entry: 'field',
      path: 'speed',
      label: 'Drift',
      min: 0,
      max: 0.3,
      step: 0.01,
    },
    {
      kind: 'slider',
      entry: 'field',
      path: 'scale',
      label: 'Scale',
      min: 1,
      max: 10,
      step: 0.1,
    },
    // 180° turns the patches back onto the same line, so the range stops there.
    {
      kind: 'slider',
      entry: 'field',
      path: 'angle',
      label: 'Angle',
      min: 0,
      max: 180,
      step: 1,
    },
    {
      kind: 'slider',
      entry: 'trail',
      path: 'radius',
      label: 'Heat radius',
      min: 0.04,
      max: 0.3,
      step: 0.01,
    },
    // decay is in seconds. A moving pointer trails about as far as it
    // travels in that time, so a longer decay draws a longer tail.
    {
      kind: 'slider',
      entry: 'trail',
      path: 'decay',
      label: 'Trail length',
      min: 0,
      max: 1.5,
      step: 0.05,
    },
  ],
});

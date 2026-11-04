'use client';

// Hand-written scene that tests composition 2's direction (SHA-304): a
// heat-map LED wall that the pointer heats, from existing Sources and Effects
// only. Each place it falls short of the reference is a sub-issue of SHA-304.
// The frame keeps the homepage hero's 1636 by 696 CSS pixel proportions, the
// size the Gallery's GPU budget is measured at.
import { useState } from 'react';

import {
  CursorTrail,
  type CursorTrailProps,
  FractalNoise,
  type FractalNoiseProps,
  LedWall,
  type LedWallProps,
  PaletteMap,
  type PaletteMapProps,
  ShaderScene,
} from '@camp-dev/shaders';

// Shaped like a composition document's stack and presets, keyed by entry id,
// in the brief's planned order: the field, the trail's heat added to it,
// the palette map, then the wall.
interface StackProps {
  field: FractalNoiseProps;
  trail: CursorTrailProps;
  palette: PaletteMapProps;
  wall: LedWallProps;
}

interface Preset {
  name: string;
  // The color behind the canvas. This route leaves LedWall's panelColor
  // unset, so the gutters are transparent and this color shows through them.
  backdrop?: string;
  props: { [Id in keyof StackProps]?: Partial<StackProps[Id]> };
}

// ---------------------------------------------
// The stack's props
// ---------------------------------------------
// The reference look. Each preset below overrides some of these.
const STACK_PROPS: StackProps = {
  // The heat field, as a value from black to white that PaletteMap turns
  // into color. contrast spreads the noise wide enough to reach every
  // palette color. angle and stretch draw the features out into the
  // reference's streaks, climbing from lower left to upper right at 30
  // degrees. scale counts features across the streaks, and speed 0.05 is a
  // slow drift, a quarter of the default.
  field: {
    angle: 30,
    balance: 0.5,
    contrast: 1.75,
    detail: 0.45,
    octaves: 6,
    scale: 5,
    speed: 0.05,
    stops: [{ color: 'oklch(0 0 0)' }, { color: 'oklch(1 0 0)' }],
    stretch: 3,
  },
  // The cursor heat, added to the field's value before the palette map, so
  // the spot and its trail pass through the same palette and dither as the
  // field. radius is in canvas heights, and the brush fades to nothing at
  // its edge, so the visible spot is smaller: 0.1 of the hero's 696 px
  // reaches about 70 px. The tail draws in over half a second, and a still
  // pointer holds a steady spot, as in the reference. grow 0.75 swells a
  // fast stroke to up to three quarters again as wide.
  trail: { decay: 0.5, grow: 0.75, hold: true, intensity: 1, radius: 0.1 },
  // Six colors, cold to hot, sampled from the reference recording. One
  // color per 8 CSS px cell, matched to the wall's spacing, so each dot
  // takes one color. spread 1 scatters the two colors at each band edge
  // across the whole step between them, as the reference's dither does.
  palette: {
    colors: [
      'oklch(0.99 0 0)',
      'oklch(0.26 0.039 271)',
      'oklch(0.54 0.18 270)',
      'oklch(0.82 0.158 85)',
      'oklch(0.92 0.215 120)',
      'oklch(0.61 0.195 31)',
    ],
    pixelSize: 8,
    spread: 1,
  },
  // One color per 8 CSS px cell with a 1 px gutter, and none of LedWall's
  // motion: no flicker, no swell. variation is left at its default of 0.5,
  // so each dot keeps a fixed random brightness of 50 to 100%.
  wall: { bleed: 0, dotSize: 7, flicker: 0, spacing: 8, swell: 0 },
};

// ---------------------------------------------
// Presets
// ---------------------------------------------
const DEFAULT_PRESET: Preset = { name: 'Thermal', backdrop: '#fff', props: {} };

const PRESETS: Preset[] = [
  DEFAULT_PRESET,
  {
    // A thermal camera at night: black cold, through violet and magenta, to
    // a yellow-white core.
    name: 'Infrared',
    backdrop: '#000',
    props: {
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
    },
  },
  {
    // Newsprint: four inks, fine cells, no color at all. The palette's
    // cells shrink with the wall's spacing.
    name: 'Newsprint',
    backdrop: '#fff',
    props: {
      palette: {
        colors: ['oklch(0.99 0 0)', 'oklch(0.80 0 0)', 'oklch(0.50 0 0)', 'oklch(0.18 0 0)'],
        pixelSize: 6,
      },
      wall: { dotSize: 5, spacing: 6 },
    },
  },
  {
    // Risograph inks on paper. The off-white paper is the cold end of the
    // ramp, then blue and fluorescent pink, then yellow at the hot end.
    name: 'Risograph',
    backdrop: '#fff',
    props: {
      palette: {
        colors: [
          'oklch(0.97 0.01 90)',
          'oklch(0.45 0.17 265)',
          'oklch(0.68 0.24 0)',
          'oklch(0.88 0.17 95)',
        ],
      },
    },
  },
];

// Loading a preset starts from the stack's props and applies its override, the
// rule composition presets follow, so every preset is complete.
const resolve = ({ props }: Preset): StackProps => ({
  field: { ...STACK_PROPS.field, ...props.field },
  trail: { ...STACK_PROPS.trail, ...props.trail },
  palette: { ...STACK_PROPS.palette, ...props.palette },
  wall: { ...STACK_PROPS.wall, ...props.wall },
});

// Entry ids in stack order, for the toggles that switch an entry off to show
// what it adds.
const ENTRY_IDS: Array<keyof StackProps> = ['field', 'trail', 'palette', 'wall'];

const TOOLBAR_STYLE = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 16,
  marginBottom: 16,
  color: '#000',
  font: '13px ui-monospace, monospace',
} as const;

// ---------------------------------------------
// Scene
// ---------------------------------------------
export default function RoughScene() {
  const [preset, setPreset] = useState(DEFAULT_PRESET);
  const [hidden, setHidden] = useState<ReadonlySet<keyof StackProps>>(new Set());
  const { field, trail, palette, wall } = resolve(preset);
  const shows = (id: keyof StackProps) => !hidden.has(id);
  const toggle = (id: keyof StackProps) =>
    setHidden((current) => {
      const next = new Set(current);

      if (!next.delete(id)) next.add(id);

      return next;
    });

  return (
    <div style={{ padding: 24, background: '#888', minHeight: '100vh' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {PRESETS.map((candidate) => (
          <button
            aria-pressed={candidate === preset}
            key={candidate.name}
            onClick={() => setPreset(candidate)}
            style={{
              padding: '6px 12px',
              border: '1px solid #444',
              borderRadius: 6,
              background: candidate === preset ? '#fff' : '#111',
              color: candidate === preset ? '#000' : '#fff',
              font: '13px ui-monospace, monospace',
            }}
            type="button"
          >
            {candidate.name}
          </button>
        ))}
      </div>
      <div style={TOOLBAR_STYLE}>
        {ENTRY_IDS.map((id) => (
          <label key={id} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input checked={shows(id)} onChange={() => toggle(id)} type="checkbox" />
            {id}
          </label>
        ))}
      </div>
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 1636,
          aspectRatio: '1636 / 696',
          background: preset.backdrop,
        }}
      >
        <ShaderScene>
          {shows('field') && <FractalNoise {...field} />}
          {shows('trail') && <CursorTrail {...trail} />}
          {shows('palette') && <PaletteMap {...palette} />}
          {shows('wall') && <LedWall {...wall} />}
        </ShaderScene>
      </div>
    </div>
  );
}

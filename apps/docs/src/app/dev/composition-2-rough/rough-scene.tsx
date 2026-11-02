'use client';

// Hand-written scene that tests composition 2's direction (SHA-304): a
// heat-map LED wall that the pointer heats, from existing Sources and Effects
// only. Each place it falls short of the reference is a sub-issue of SHA-304.
// The frame keeps the homepage hero's 1636 by 696 CSS pixel proportions, the
// size the Gallery's GPU budget is measured at.
import { useState } from 'react';

import {
  CursorSpotlight,
  type CursorSpotlightProps,
  FractalNoise,
  type FractalNoiseProps,
  LedWall,
  type LedWallProps,
  ShaderScene,
} from '@camp-dev/shaders';

// Shaped like a composition document's stack and presets, keyed by entry id.
// The brief's planned stack differs: `field` holds the palette here, which
// moves to a `palette` entry once PaletteMap exists, and `heat` stands in for
// a `trail` entry.
interface StackProps {
  field: FractalNoiseProps;
  heat: CursorSpotlightProps;
  wall: LedWallProps;
}

interface Preset {
  name: string;
  // Stand-in for a gap: LedWall leaves its gutters transparent, so the page
  // behind the canvas colors them. A composition can't set that, so this
  // route paints the frame per preset until the gap has an answer.
  backdrop?: string;
  props: { [Id in keyof StackProps]?: Partial<StackProps[Id]> };
}

// ---------------------------------------------
// The stack's props
// ---------------------------------------------
// The reference look. Each preset below overrides some of these.
const STACK_PROPS: StackProps = {
  // The heat field. Six auto-spaced stops, cold to hot, sampled from the
  // reference recording. softness 0 snaps the field to one flat band per
  // stop, and contrast spreads the noise wide enough to reach all six. The
  // band edges are clean contours, not the reference's dither. scale counts
  // broad features across the canvas, and speed 0.05 is a slow drift, a
  // quarter of the default.
  field: {
    balance: 0.5,
    contrast: 2.2,
    detail: 0.45,
    octaves: 6,
    scale: 2.5,
    softness: 0,
    speed: 0.05,
    stops: [
      { color: 'oklch(0.99 0 0)' },
      { color: 'oklch(0.26 0.039 271)' },
      { color: 'oklch(0.54 0.18 270)' },
      { color: 'oklch(0.82 0.158 85)' },
      { color: 'oklch(0.92 0.215 120)' },
      { color: 'oklch(0.61 0.195 31)' },
    ],
  },
  // Stand-in for cursor heat. It brightens a round spot after the palette,
  // so it can't push a cell into a hotter color, and it leaves no trail.
  // radius is in canvas heights: 0.14 of the hero's 696 px is about 100 px.
  heat: { intensity: 0.6, radius: 0.14 },
  // One color per 8 CSS px cell with a 1 px gutter, and none of LedWall's
  // motion: no flicker, no swell. Each dot still keeps a permanent random
  // brightness of 50 to 100%, which no prop turns off.
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
      field: {
        stops: [
          { color: 'oklch(0.12 0.02 280)' },
          { color: 'oklch(0.30 0.14 290)' },
          { color: 'oklch(0.50 0.22 340)' },
          { color: 'oklch(0.68 0.20 30)' },
          { color: 'oklch(0.84 0.17 75)' },
          { color: 'oklch(0.97 0.08 100)' },
        ],
      },
    },
  },
  {
    // Newsprint: four inks, fine cells, no color at all.
    name: 'Newsprint',
    backdrop: '#fff',
    props: {
      field: {
        stops: [
          { color: 'oklch(0.99 0 0)' },
          { color: 'oklch(0.80 0 0)' },
          { color: 'oklch(0.50 0 0)' },
          { color: 'oklch(0.18 0 0)' },
        ],
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
      field: {
        stops: [
          { color: 'oklch(0.97 0.01 90)' },
          { color: 'oklch(0.45 0.17 265)' },
          { color: 'oklch(0.68 0.24 0)' },
          { color: 'oklch(0.88 0.17 95)' },
        ],
      },
    },
  },
];

// Loading a preset starts from the stack's props and applies its override, the
// rule composition presets follow, so every preset is complete.
const resolve = ({ props }: Preset): StackProps => ({
  field: { ...STACK_PROPS.field, ...props.field },
  heat: { ...STACK_PROPS.heat, ...props.heat },
  wall: { ...STACK_PROPS.wall, ...props.wall },
});

// Entry ids in stack order, for the toggles that switch an entry off to show
// what it adds.
const ENTRY_IDS: Array<keyof StackProps> = ['field', 'heat', 'wall'];

// ---------------------------------------------
// Scene
// ---------------------------------------------
export default function RoughScene() {
  const [preset, setPreset] = useState(DEFAULT_PRESET);
  const [hidden, setHidden] = useState<ReadonlySet<keyof StackProps>>(new Set());
  const { field, heat, wall } = resolve(preset);
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
      <div
        style={{ display: 'flex', gap: 16, marginBottom: 16, font: '13px ui-monospace, monospace' }}
      >
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
          {shows('heat') && <CursorSpotlight {...heat} />}
          {shows('wall') && <LedWall {...wall} />}
        </ShaderScene>
      </div>
    </div>
  );
}

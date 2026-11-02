'use client';

// Hand-written scene that proves composition 1's direction, "Reeded glass"
// (SHA-292): slow color behind fluted glass, with the pointer pulling the
// color. SHA-300 lifted it into compositions/reeded-glass/composition.ts.
// The frame keeps the homepage hero's 1636 by 696 CSS pixel proportions, the
// size the Gallery's GPU budget is measured at.
import { useState } from 'react';

import {
  CursorSmudge,
  type CursorSmudgeProps,
  FlutedGlass,
  type FlutedGlassProps,
  Grain,
  type GrainProps,
  LiquidGradient,
  type LiquidGradientProps,
  ShaderScene,
  Vignette,
  type VignetteProps,
} from '@camp-dev/shaders';

// Shaped like a composition document's stack and presets, keyed by entry id,
// so the assembly ticket can lift these values straight into one.
interface StackProps {
  gradient: LiquidGradientProps;
  smudge: CursorSmudgeProps;
  glass: FlutedGlassProps;
  grain: GrainProps;
  vignette: VignetteProps;
}

interface Preset {
  name: string;
  props: { [Id in keyof StackProps]?: Partial<StackProps[Id]> };
}

// ---------------------------------------------
// The stack's props
// ---------------------------------------------
// The Default look. Each preset below overrides some of these.
const STACK_PROPS: StackProps = {
  // Plum to rose to apricot: 60° of hue, with depth carried by lightness.
  gradient: {
    angle: 20,
    speed: 0.12,
    stops: [
      { color: 'oklch(0.30 0.11 345)' },
      { color: 'oklch(0.52 0.17 15)' },
      { color: 'oklch(0.76 0.14 45)' },
    ],
    swirl: 1.1,
  },
  // A slightly wider, weaker brush than the default (radius and pull in canvas
  // heights), which also eases back a little slower.
  smudge: { decay: 0.35, radius: 0.2, strength: 0.1 },
  // Flutes widened from 30 to 44 CSS px for a hero-sized canvas, with a little
  // more color fringing, wall highlight, and groove shadow than the defaults.
  glass: { dispersion: 0.25, fluteWidth: 44, highlight: 0.2, shadow: 0.25 },
  grain: { intensity: 0.06 },
  vignette: { intensity: 0.35 },
};

// ---------------------------------------------
// Presets
// ---------------------------------------------
const DEFAULT_PRESET: Preset = { name: 'Default', props: {} };

const PRESETS: Preset[] = [
  DEFAULT_PRESET,
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
];

// Loading a preset starts from the stack's props and applies its override, the
// rule composition presets follow, so every preset is complete.
const resolve = ({ props }: Preset): StackProps => ({
  gradient: { ...STACK_PROPS.gradient, ...props.gradient },
  smudge: { ...STACK_PROPS.smudge, ...props.smudge },
  glass: { ...STACK_PROPS.glass, ...props.glass },
  grain: { ...STACK_PROPS.grain, ...props.grain },
  vignette: { ...STACK_PROPS.vignette, ...props.vignette },
});

// ---------------------------------------------
// Scene
// ---------------------------------------------
export default function RoughScene() {
  const [preset, setPreset] = useState(DEFAULT_PRESET);
  const { gradient, smudge, glass, grain, vignette } = resolve(preset);

  return (
    <div style={{ padding: 24, background: '#000', minHeight: '100vh' }}>
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
        style={{ position: 'relative', width: '100%', maxWidth: 1636, aspectRatio: '1636 / 696' }}
      >
        <ShaderScene>
          <LiquidGradient {...gradient} />
          <CursorSmudge {...smudge} />
          <FlutedGlass {...glass} />
          <Grain {...grain} />
          <Vignette {...vignette} />
        </ShaderScene>
      </div>
    </div>
  );
}

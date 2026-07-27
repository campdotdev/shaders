'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';

import { palette, paletteOklch } from '@/lib/palette';

import { swatchBorder } from './swatch-border';

/**
 * `LightnessGrid` reads colors through `@lovo/matter`'s `linearSrgbToOklch` /
 * `parseColorString`, which pulls in the bundled WebGPU renderer and crashes
 * any server render that reaches it (the three/webgpu SSR gotcha in
 * AGENTS.md). Loading it client-only, the same way `ColorInput` loads its
 * popover contents, keeps the rest of this page — which needs none of that —
 * servable.
 */
const LightnessGrid = dynamic(
  () => import('./LightnessGrid').then((module) => module.LightnessGrid),
  { ssr: false },
);

const { black, white, gray, moss } = palette;
const {
  limeScale: limeScaleOklch,
  lime: limeOklch,
  red: redOklch,
  orange: orangeOklch,
  amber: amberOklch,
  green: greenOklch,
  teal: tealOklch,
  cyan: cyanOklch,
  sky: skyOklch,
  blue: blueOklch,
  violet: violetOklch,
  purple: purpleOklch,
  magenta: magentaOklch,
} = paletteOklch;

// ───────────────────────── Accent data ─────────────────────────

interface AccentEntry {
  name: string;
  angle: number;
  /** Twelve steps, darkest first, in their wide-gamut oklch form. */
  oklch: readonly string[];
}

const ACCENTS: AccentEntry[] = [
  { name: 'red', angle: 25, oklch: redOklch },
  { name: 'orange', angle: 55, oklch: orangeOklch },
  { name: 'amber', angle: 85, oklch: amberOklch },
  { name: 'lime', angle: 120, oklch: limeOklch },
  { name: 'green', angle: 145.897, oklch: greenOklch },
  { name: 'teal', angle: 175, oklch: tealOklch },
  { name: 'cyan', angle: 205, oklch: cyanOklch },
  { name: 'sky', angle: 235, oklch: skyOklch },
  { name: 'blue', angle: 265.847, oklch: blueOklch },
  { name: 'violet', angle: 293.328, oklch: violetOklch },
  { name: 'purple', angle: 320, oklch: purpleOklch },
  { name: 'magenta', angle: 343.895, oklch: magentaOklch },
];

// ───────────────────────── Aurora old → new ─────────────────────────
//
// Aurora originally shipped four hand-picked hexes. It now defaults to four
// stops pulled from the palette instead — but not one rung of one hue: the
// stops sit at different rungs (green[10], teal[9], sky[9], magenta[8]) and
// two of the four hues (teal, sky) didn't exist in the old lineup at all. So
// there's no hue-for-hue pairing to draw anymore, just two independent
// four-color sets that can be compared as compositions.

/** Aurora's four original hand-picked default hexes. */
const AURORA_OLD_HEXES = ['#09E24B', '#1837E6', '#661ACC', '#CC1A99'];

interface AuroraStop {
  /** Palette reference this stop pulls its color from. */
  ref: string;
  color: string;
}

/** Aurora's current default stops (see `DEFAULT_STOPS` in `registry/aurora/aurora.tsx`), in curtain order. */
const AURORA_NEW_STOPS: AuroraStop[] = [
  { ref: 'green[10]', color: greenOklch[10] },
  { ref: 'teal[9]', color: tealOklch[9] },
  { ref: 'sky[9]', color: skyOklch[9] },
  { ref: 'magenta[8]', color: magentaOklch[8] },
];

// ───────────────────────── Components ─────────────────────────

function Section({
  title,
  subtitle,
  children,
  bg,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  bg: string;
}) {
  const fg = bg === 'dark' ? white : black;
  const subFg = bg === 'dark' ? gray[7] : gray[6];

  return (
    <section style={{ marginBottom: 56 }}>
      <h2 style={{ color: fg, fontSize: 18, fontWeight: 600, margin: '0 0 4px 0' }}>{title}</h2>
      {subtitle !== undefined && subtitle !== '' ? (
        <p style={{ color: subFg, fontSize: 13, margin: '0 0 20px 0' }}>{subtitle}</p>
      ) : (
        <div style={{ height: 16 }} />
      )}
      {children}
    </section>
  );
}

function ScaleRow({
  name,
  sub,
  swatches,
  bg,
  brandStep,
}: {
  name: string;
  sub?: string;
  /**
   * The twelve colors to paint, darkest first. Neutrals pass their hex form;
   * accents pass oklch so a wide-gamut display shows the chroma the scale
   * actually reaches.
   */
  swatches: readonly string[];
  bg: string;
  brandStep?: number;
}) {
  const fg = bg === 'dark' ? white : black;
  const subFg = bg === 'dark' ? gray[7] : gray[6];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '120px 1fr',
        gap: 16,
        alignItems: 'center',
      }}
    >
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: fg }}>{name}</div>
        {sub !== undefined && sub !== '' ? (
          <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: subFg }}>
            {sub}
          </div>
        ) : null}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 4 }}>
        {swatches.map((color, stepIndex) => {
          const stepNum = stepIndex + 1;
          const ringed = brandStep === stepNum;

          return (
            <div
              key={`${name}-${stepNum}`}
              style={{ display: 'flex', flexDirection: 'column', gap: 2 }}
              title={`${name} / ${stepNum} · ${color}`}
            >
              <div
                style={{
                  background: color,
                  height: 42,
                  borderRadius: 4,
                  border: ringed
                    ? `1px solid ${fg}`
                    : swatchBorder(bg === 'dark' ? 'dark' : 'light'),
                  outline: ringed ? `2px solid ${color}` : 'none',
                  outlineOffset: 2,
                }}
              />
              <div
                style={{
                  fontFamily: 'ui-monospace, monospace',
                  fontSize: 9,
                  color: subFg,
                  textAlign: 'center',
                }}
              >
                {stepNum}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ColorBlock({
  color,
  label,
  sub,
  bg,
  height = 88,
}: {
  color: string;
  label: string;
  sub?: string;
  bg: string;
  height?: number;
}) {
  const fg = bg === 'dark' ? white : black;
  const subFg = bg === 'dark' ? gray[7] : gray[6];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div
        style={{
          background: color,
          height,
          borderRadius: 10,
          border: swatchBorder(bg === 'dark' ? 'dark' : 'light'),
          boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
        }}
      />
      <div style={{ fontSize: 13, fontWeight: 600, color: fg }}>{label}</div>
      {sub !== undefined && sub !== '' ? (
        <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: subFg }}>
          {sub}
        </div>
      ) : null}
    </div>
  );
}

function GradientBlock({
  colors,
  label,
  bg,
  height = 110,
}: {
  colors: string[];
  label: string;
  bg: string;
  height?: number;
}) {
  const subFg = bg === 'dark' ? gray[7] : gray[6];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 12, color: subFg }}>{label}</div>
      <div
        style={{
          height,
          borderRadius: 10,
          border: swatchBorder(bg === 'dark' ? 'dark' : 'light'),
          background: `linear-gradient(135deg, ${colors.join(', ')})`,
        }}
      />
    </div>
  );
}

// ───────────────────────── Page ─────────────────────────

export function PaletteView() {
  const [bg, setBg] = useState<'dark' | 'light'>('dark');
  const pageBg = bg === 'dark' ? black : white;
  const fg = bg === 'dark' ? white : black;
  const subFg = bg === 'dark' ? gray[7] : gray[6];
  const border = bg === 'dark' ? gray[2] : gray[10];

  const auroraNew = AURORA_NEW_STOPS.map((stop) => stop.color);

  // Brand lime mid step (index 9 of the 12-step brand scale = #A4C102)
  const brandLimeMid = limeScaleOklch[9];

  return (
    <div
      style={{
        background: pageBg,
        color: fg,
        minHeight: '100vh',
        padding: '32px 40px 80px',
        transition: 'background 150ms',
      }}
    >
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 32,
          }}
        >
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Matter palette</h1>
            <p style={{ color: subFg, fontSize: 14, margin: '4px 0 0' }}>
              Gray, moss, and all twelve accents share one twelve-step lightness ladder; the brand
              lime scale runs a ladder of its own.
            </p>
          </div>
          <button
            onClick={() => {
              setBg(bg === 'dark' ? 'light' : 'dark');
            }}
            style={{
              background: 'transparent',
              color: fg,
              border: `1px solid ${border}`,
              borderRadius: 6,
              padding: '8px 14px',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            {bg === 'dark' ? 'Light bg' : 'Dark bg'}
          </button>
        </header>
        {/* ── Everything, on one axis ── */}
        <Section
          bg={bg}
          subtitle="Every scale on a shared lightness axis. Neutrals and every accent land on the same twelve-step ladder; the brand lime scale runs a ladder of its own."
          title="The whole palette"
        >
          <LightnessGrid bg={bg} />
        </Section>
        {/* ── Brand foundation ── */}
        <Section
          bg={bg}
          subtitle="Two neutrals on one lightness ladder: gray is untinted and serves the shader palette, moss carries the brand hue and dresses the site. Brand black/white are the moss end steps."
          title="Brand foundation"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <ScaleRow bg={bg} name="gray" sub="untinted · shaders" swatches={gray} />
            <ScaleRow bg={bg} name="moss" sub="h=120 · brand chrome" swatches={moss} />
            <ScaleRow
              bg={bg}
              brandStep={10}
              name="limeScale"
              sub="brand · h=120 · 12 steps"
              swatches={limeScaleOklch}
            />
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 20,
              marginTop: 24,
            }}
          >
            <ColorBlock bg={bg} color={black} label="black" sub={black} />
            <ColorBlock bg={bg} color={white} label="white" sub={white} />
          </div>
        </Section>
        {/* ── Accent palette ── */}
        <Section
          bg={bg}
          subtitle="Twelve hues on the same twelve-step lightness ladder as the neutrals, so red[8] and gray[8] are the same brightness. Chroma at each step is as much as Display-P3 holds there, tapering away from each hue's own most-saturated step — which is why the vivid step sits at a different index per hue."
          title="Accent palette — 12 hues x 12 steps"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {ACCENTS.map((accent) => (
              <ScaleRow
                bg={bg}
                key={accent.name}
                name={accent.name}
                sub={`h=${accent.angle}`}
                swatches={accent.oklch}
              />
            ))}
          </div>
        </Section>
        {/* ── Aurora comparison ── */}
        <Section
          bg={bg}
          subtitle="Aurora's four launch hexes against the palette stops its defaults use today — four independent picks each, not a hue-for-hue swap."
          title="Aurora — launch hexes vs current defaults"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
              {AURORA_NEW_STOPS.map((stop) => (
                <ColorBlock
                  bg={bg}
                  color={stop.color}
                  key={stop.ref}
                  label={stop.ref}
                  sub={stop.color}
                />
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
              <GradientBlock bg={bg} colors={AURORA_OLD_HEXES} label="Aurora stack (old)" />
              <GradientBlock bg={bg} colors={auroraNew} label="Aurora stack (new defaults)" />
            </div>
          </div>
        </Section>
        {/* ── Sample compositions ── */}
        <Section
          bg={bg}
          subtitle="A few useful gradients drawn from the palette."
          title="Sample compositions"
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            <GradientBlock
              bg={bg}
              colors={[black, brandLimeMid, white]}
              label="Brand identity: ink → lime → paper"
            />
            <GradientBlock
              bg={bg}
              colors={[violetOklch[6], blueOklch[8], brandLimeMid]}
              label="Cool ramp: violet[6] → blue[8] → brand lime"
            />
            <GradientBlock
              bg={bg}
              colors={[magentaOklch[6], magentaOklch[8], amberOklch[8]]}
              label="Warm ramp: magenta[6] → magenta[8] → amber[8]"
            />
            <GradientBlock
              bg={bg}
              colors={[blueOklch[10], violetOklch[10], magentaOklch[10]]}
              label="Soft pastel: blue[10] → violet[10] → magenta[10]"
            />
            <GradientBlock
              bg={bg}
              colors={[limeScaleOklch[3], limeScaleOklch[6], limeScaleOklch[9]]}
              label="Brand lime scale ramp (steps 4 → 7 → 10)"
            />
            <GradientBlock
              bg={bg}
              colors={[
                redOklch[8],
                orangeOklch[8],
                amberOklch[8],
                limeOklch[8],
                brandLimeMid,
                greenOklch[8],
                tealOklch[8],
                cyanOklch[8],
                skyOklch[8],
                blueOklch[8],
                violetOklch[8],
                purpleOklch[8],
                magentaOklch[8],
              ]}
              label="All rung-8 accents around the wheel"
            />
          </div>
        </Section>
        {/* ── Stress test ── */}
        <Section
          bg={bg}
          subtitle="Stress test — do all 12 rung-8 accents and brand lime read on both brand backgrounds?"
          title="Rung 8 on ink + paper"
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            {(
              [
                { name: 'black', color: black },
                { name: 'white', color: white },
              ] as const
            ).map(({ name: bgName, color: bgColor }) => (
              <div
                key={bgName}
                style={{
                  background: bgColor,
                  borderRadius: 10,
                  padding: 20,
                  border: swatchBorder(bg === 'dark' ? 'dark' : 'light'),
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, 1fr)',
                  gap: 10,
                }}
              >
                {[
                  { name: 'brandLime', color: brandLimeMid },
                  ...ACCENTS.map((accent) => ({ name: accent.name, color: accent.oklch[8] ?? '' })),
                ].map(({ name: chipName, color }) => (
                  <div
                    key={chipName}
                    style={{
                      background: color,
                      height: 56,
                      borderRadius: 6,
                      // The panel is a fixed black/white, independent of the page
                      // theme, so the border follows the panel, not `bg`.
                      border: swatchBorder(bgName === 'black' ? 'dark' : 'light'),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: 'ui-monospace, monospace',
                      fontSize: 10,
                      color: bgColor === black ? black : white,
                      fontWeight: 600,
                    }}
                  >
                    {chipName}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}

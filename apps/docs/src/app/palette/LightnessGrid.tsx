'use client';

// One chart for the whole palette, rendered by PaletteView and reading colors
// from @/lib/palette. Every scale is a row and the horizontal axis is lightness,
// so scales can be compared directly: where the neutrals sit against the brand
// ramp, and which lightnesses the accents actually cover. Positions are continuous
// rather than snapped to the neutral ladder, which is now a formality for the
// accents — every one of them sits on a tick — but still matters for limeScale,
// whose ramp has a ladder of its own.
import { linearSrgbToOklch, parseColorString } from '@mattermix/shaders/color';

import { palette, paletteOklch } from '@/lib/palette';

import { swatchBorder } from './swatch-border';

// Axis bounds, a little wider than the darkest and lightest colors in the
// system so end swatches are not clipped by the container edge.
const AXIS_MIN = 0.15;
const AXIS_MAX = 0.95;

/** Lightness of any palette color, read back through the engine's own math. */
function lightnessOf(value: string): number {
  return linearSrgbToOklch(...parseColorString(value))[0];
}

/** Hue of any palette color, read back through the engine's own math. */
function hueOf(value: string): number {
  return linearSrgbToOklch(...parseColorString(value))[2];
}

// The palette's hues are authored to at most 3 decimals, but the round trip
// through linear-sRGB reintroduces floating-point noise past that: green's
// authored 145.897 comes back as 145.89699335925496. Rounding to 3 decimals
// recovers the authored value so the label matches what the palette declares.
function roundedHue(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** Lightness to a left offset in percent. */
function axisPosition(lightness: number): number {
  const percent = ((lightness - AXIS_MIN) / (AXIS_MAX - AXIS_MIN)) * 100;

  // Clamp to 0-100: AXIS_MIN and AXIS_MAX are wider than today's palette bounds
  // (darkest 0.163, lightest 0.933), so a future color outside this range renders
  // at the container edge rather than disappearing off-screen.
  return Math.max(0, Math.min(100, percent));
}

interface RowEntry {
  /** Displayed color, always the hex form so it renders on any display. */
  color: string;
  /** Color the lightness is measured from — the oklch form, which is exact. */
  source: string;
  label: string;
}

interface Row {
  name: string;
  note: string;
  entries: RowEntry[];
}

function scaleRow(
  name: string,
  note: string,
  hexes: readonly string[],
  oklchs: readonly string[],
): Row {
  return {
    name,
    note,
    entries: hexes.map((color, index) => ({
      color,
      source: oklchs[index] ?? color,
      label: String(index),
    })),
  };
}

function accentRow(name: string, hexes: readonly string[], oklchs: readonly string[]): Row {
  // The hue label is read back from a mid scale step rather than hardcoded, so
  // it cannot drift from the values. Rung 8 is a safe pick for every accent:
  // it carries plenty of chroma, and hue is only meaningful where chroma is.
  return scaleRow(name, `h=${roundedHue(hueOf(oklchs[8] ?? ''))}`, hexes, oklchs);
}

const NEUTRAL_ROWS: Row[] = [
  scaleRow('gray', 'untinted · shaders', palette.gray, paletteOklch.gray),
  scaleRow('moss', 'h=120 · brand chrome', palette.moss, paletteOklch.moss),
];

const BRAND_ROWS: Row[] = [
  scaleRow('limeScale', 'h=120 · brand ramp', palette.limeScale, paletteOklch.limeScale),
];

const ACCENT_ROWS: Row[] = [
  accentRow('red', palette.red, paletteOklch.red),
  accentRow('orange', palette.orange, paletteOklch.orange),
  accentRow('amber', palette.amber, paletteOklch.amber),
  accentRow('lime', palette.lime, paletteOklch.lime),
  accentRow('green', palette.green, paletteOklch.green),
  accentRow('teal', palette.teal, paletteOklch.teal),
  accentRow('cyan', palette.cyan, paletteOklch.cyan),
  accentRow('sky', palette.sky, paletteOklch.sky),
  accentRow('blue', palette.blue, paletteOklch.blue),
  accentRow('violet', palette.violet, paletteOklch.violet),
  accentRow('purple', palette.purple, paletteOklch.purple),
  accentRow('magenta', palette.magenta, paletteOklch.magenta),
];

/** Tick positions: the shared neutral ladder, drawn behind every row. */
const TICKS = paletteOklch.gray.map(lightnessOf);

function GridRow({
  row,
  fg,
  subFg,
  border,
  bg,
}: {
  row: Row;
  fg: string;
  subFg: string;
  border: string;
  bg: 'dark' | 'light';
}) {
  return (
    <div
      style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 16, alignItems: 'center' }}
    >
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: fg }}>{row.name}</div>
        <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: subFg }}>
          {row.note}
        </div>
      </div>
      <div style={{ position: 'relative', height: 40 }}>
        {TICKS.map((tick) => (
          <div
            key={`tick-${tick}`}
            style={{
              position: 'absolute',
              left: `${axisPosition(tick)}%`,
              top: 0,
              bottom: 0,
              width: 1,
              background: border,
            }}
          />
        ))}
        {row.entries.map((entry) => (
          <div
            key={`${row.name}-${entry.label}`}
            style={{
              position: 'absolute',
              left: `${axisPosition(lightnessOf(entry.source))}%`,
              transform: 'translateX(-50%)',
              top: 2,
              width: 30,
              height: 36,
              borderRadius: 4,
              background: entry.color,
              border: swatchBorder(bg),
            }}
            title={`${row.name} / ${entry.label} · ${entry.color} · ${entry.source}`}
          />
        ))}
      </div>
    </div>
  );
}

export function LightnessGrid({ bg }: { bg: 'dark' | 'light' }) {
  const fg = bg === 'dark' ? palette.white : palette.black;
  const subFg = bg === 'dark' ? palette.gray[7] : palette.gray[6];
  const border = bg === 'dark' ? palette.gray[2] : palette.gray[10];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {NEUTRAL_ROWS.map((row) => (
          <GridRow bg={bg} border={border} fg={fg} key={row.name} row={row} subFg={subFg} />
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {BRAND_ROWS.map((row) => (
          <GridRow bg={bg} border={border} fg={fg} key={row.name} row={row} subFg={subFg} />
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {ACCENT_ROWS.map((row) => (
          <GridRow bg={bg} border={border} fg={fg} key={row.name} row={row} subFg={subFg} />
        ))}
      </div>
      <p style={{ color: subFg, fontSize: 12, margin: 0 }}>
        Vertical rules mark the twelve-step lightness ladder every scale except limeScale shares.
        Accents land exactly on it, which is the point — the same-numbered step of any two scales is
        the same brightness.
      </p>
    </div>
  );
}

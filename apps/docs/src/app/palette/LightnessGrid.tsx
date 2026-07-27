'use client';

// One chart for the whole palette. Every scale is a row and the horizontal axis
// is lightness, so scales can be compared directly: where the neutrals sit
// against the brand ramp, and which lightnesses the accents actually cover.
// Positions are continuous rather than snapped to the neutral ladder — snapping
// collides, because amber and green each round two of their three steps into
// one column.
import { linearSrgbToOklch, parseColorString } from '@lovo/matter';

import { palette, paletteOklch } from '@/lib/palette';

// Axis bounds, a little wider than the darkest and lightest colors in the
// system so end swatches are not clipped by the container edge.
const AXIS_MIN = 0.15;
const AXIS_MAX = 0.95;

/** Lightness of any palette color, read back through the engine's own math. */
function lightnessOf(value: string): number {
  return linearSrgbToOklch(...parseColorString(value))[0];
}

/** Lightness to a left offset in percent. */
function axisPosition(lightness: number): number {
  return ((lightness - AXIS_MIN) / (AXIS_MAX - AXIS_MIN)) * 100;
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

function accentRow(
  name: string,
  hue: number,
  hexes: { light: string; base: string; dark: string },
  oklchs: { light: string; base: string; dark: string },
): Row {
  return {
    name,
    note: `h=${hue}`,
    entries: (['dark', 'base', 'light'] as const).map((step) => ({
      color: hexes[step],
      source: oklchs[step],
      label: step,
    })),
  };
}

const NEUTRAL_ROWS: Row[] = [
  scaleRow('gray', 'untinted · shaders', palette.gray, paletteOklch.gray),
  scaleRow('moss', 'h=120 · brand chrome', palette.moss, paletteOklch.moss),
];

const BRAND_ROWS: Row[] = [
  scaleRow('limeScale', 'h=120 · brand ramp', palette.limeScale, paletteOklch.limeScale),
];

const ACCENT_ROWS: Row[] = [
  accentRow('red', 25, palette.red, paletteOklch.red),
  accentRow('orange', 55, palette.orange, paletteOklch.orange),
  accentRow('amber', 85, palette.amber, paletteOklch.amber),
  accentRow('lime', 120, palette.lime, paletteOklch.lime),
  accentRow('green', 145.897, palette.green, paletteOklch.green),
  accentRow('teal', 175, palette.teal, paletteOklch.teal),
  accentRow('cyan', 205, palette.cyan, paletteOklch.cyan),
  accentRow('sky', 235, palette.sky, paletteOklch.sky),
  accentRow('blue', 265.847, palette.blue, paletteOklch.blue),
  accentRow('violet', 293.328, palette.violet, paletteOklch.violet),
  accentRow('purple', 320, palette.purple, paletteOklch.purple),
  accentRow('magenta', 343.895, palette.magenta, paletteOklch.magenta),
];

/** Tick positions: the shared neutral ladder, drawn behind every row. */
const TICKS = paletteOklch.gray.map(lightnessOf);

function GridRow({
  row,
  fg,
  subFg,
  border,
}: {
  row: Row;
  fg: string;
  subFg: string;
  border: string;
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
          <GridRow border={border} fg={fg} key={row.name} row={row} subFg={subFg} />
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {BRAND_ROWS.map((row) => (
          <GridRow border={border} fg={fg} key={row.name} row={row} subFg={subFg} />
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {ACCENT_ROWS.map((row) => (
          <GridRow border={border} fg={fg} key={row.name} row={row} subFg={subFg} />
        ))}
      </div>
      <p style={{ color: subFg, fontSize: 12, margin: 0 }}>
        Vertical rules mark the twelve-step lightness ladder the neutrals share. Accents sit at
        their true lightness, which is why none of them reach the dark end — the system has no
        accent below L=0.34.
      </p>
    </div>
  );
}

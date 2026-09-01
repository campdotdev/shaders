import { describe, expect, it } from 'vitest';

import { extractProps, getComponentProps } from './props';

describe('extractProps', () => {
  it('extracts name, type text, and description for each interface member', async () => {
    const source = `
export interface GlowProps {
  /** Overlay strength toward the edges. */
  intensity?: number;
  /** Color blended in toward the edges. */
  color?: string;
}

export function Glow({ intensity = 0.3, color = 'red' }: GlowProps) {
  return null;
}
`;

    expect(await extractProps(source, 'Glow')).toEqual([
      {
        name: 'intensity',
        type: 'number',
        description: 'Overlay strength toward the edges.',
        defaultValue: '0.3',
        defaultSummary: '0.3',
      },
      {
        name: 'color',
        type: 'string',
        description: 'Color blended in toward the edges.',
        defaultValue: "'red'",
        defaultSummary: "'red'",
      },
    ]);
  });

  it('strips the default sentence and animatable boilerplate from descriptions', async () => {
    const source = `
export interface GlowProps {
  /**
   * Overlay strength toward the edges. 0 = no glow, 1 = full \`color\` at
   * the edge. Defaults to 0.3. Accepts a static value or an animation
   * signal.
   */
  intensity?: AnimatableProp<number>;
  /**
   * Glow center, 0..1 across the canvas. Defaults to \`[0.5, 0.5]\`. Accepts a
   * static value or an animation signal.
   */
  center?: AnimatableProp<readonly [number, number]>;
}

export function Glow({ intensity = 0.3, center = [0.5, 0.5] }: GlowProps) {
  return null;
}
`;

    const [intensity, center] = await extractProps(source, 'Glow');

    expect(intensity?.description).toBe(
      'Overlay strength toward the edges. 0 = no glow, 1 = full `color` at the edge.',
    );
    expect(center?.description).toBe('Glow center, 0..1 across the canvas.');
  });

  it('throws when a prop has no JSDoc description', async () => {
    const source = `
export interface GlowProps {
  intensity?: number;
}

export function Glow({ intensity = 0.3 }: GlowProps) {
  return null;
}
`;

    await expect(extractProps(source, 'Glow')).rejects.toThrow(/intensity.*description/);
  });

  it('resolves a named constant default to its initializer, comments stripped and formatted', async () => {
    const source = `
const DEFAULT_STOPS: ColorStop[] = [
  { color: 'oklch(0.720 0.281 343.895)' }, // paletteOklch.magenta[9]
  { color: 'oklch(0.460 0.211 320)' }, // paletteOklch.purple[6]
];

export interface GlowProps {
  /** Colors along the glow. */
  stops?: ColorStop[];
}

export function Glow({ stops = DEFAULT_STOPS }: GlowProps) {
  return null;
}
`;

    const [stops] = await extractProps(source, 'Glow');

    expect(stops?.defaultValue).toBe(
      `[
  { color: 'oklch(0.720 0.281 343.895)' },
  { color: 'oklch(0.460 0.211 320)' },
]`,
    );
  });

  it('summarizes defaults that fit a table cell and leaves large ones without one', async () => {
    const source = `
const DEFAULT_COLORS = ['oklch(0.80 0.12 250)', 'oklch(0.70 0.16 300)', 'oklch(0.75 0.14 345)'];

export interface GlowProps {
  /** Overlay strength. */
  intensity?: number;
  /** Edge color. */
  color?: string;
  /** Ray colors. */
  colors?: string[];
}

export function Glow({
  intensity = 0.3,
  color = 'oklch(0.05 0.022 0)',
  colors = DEFAULT_COLORS,
}: GlowProps) {
  return null;
}
`;

    const [intensity, color, colors] = await extractProps(source, 'Glow');

    expect(intensity?.defaultSummary).toBe('0.3');
    expect(color?.defaultSummary).toBe("'oklch(0.05 0.022 0)'");
    expect(colors?.defaultSummary).toBeUndefined();
    expect(colors?.defaultValue).toContain("'oklch(0.80 0.12 250)'");
  });
});

describe('getComponentProps', () => {
  it('extracts a real registry component by slug', async () => {
    const rows = await getComponentProps('vignette');
    const intensity = rows.find((row) => row.name === 'intensity');

    if (!intensity) throw new Error('vignette has no intensity prop');

    expect(intensity).toMatchObject({
      type: 'AnimatableProp<number>',
      defaultValue: '0.3',
    });
    expect(intensity.description).not.toMatch(/Defaults to|Accepts a static/);
  });

  it('pascal-cases multi-word slugs to find the props interface', async () => {
    const rows = await getComponentProps('god-rays');

    expect(rows.length).toBeGreaterThan(0);
  });
});

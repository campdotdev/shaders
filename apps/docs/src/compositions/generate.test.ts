// @vitest-environment node
/**
 * The code generator on a fixture of its own, so art changes to a real
 * composition never break these. The last suite holds the generator's line
 * breaking to Prettier's: it prints every component with every default set
 * and checks that the repo's Prettier config leaves the file as it is.
 */
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { format, resolveConfig } from 'prettier';
import { describe, expect, it } from 'vitest';

import { slugForComponentName } from '@/content/catalog';
import { getComponentDefaults } from '@/content/props';

import type { ComponentName, Composition } from './define';
import { defineComposition } from './define';
import { generateComposition, kebabCase, pascalCase } from './generate';
import { presetProps, type SeedFields } from './store';

const composition = defineComposition({
  slug: 'generator-test',
  title: 'Generator test',
  description: 'A stack for the generator tests.',
  stack: [
    { id: 'base', component: 'MeshGradient', props: { speed: 0.4 } },
    { id: 'grain', component: 'Grain', props: { intensity: 0.08 } },
  ],
  presets: [{ name: 'Coarse', props: { grain: { intensity: 0.08, blend: 'additive' } } }],
  controls: [],
});

const defaults = {
  base: { speed: 2, frequency: 5, palettes: [['#000', '#111', '#222', '#333']] },
  grain: { intensity: 0.15, speed: 0.3, blend: 'additive' },
};

const generate = (
  preset: string,
  edit?: (state: Record<string, Record<string, unknown>>) => void,
) => {
  const state = presetProps(composition, defaults, preset);

  edit?.(state);

  return generateComposition({ composition, preset, state, defaults });
};

describe('generateComposition', () => {
  it('prints the file around the stack', () => {
    expect(generate('Default')).toBe(`'use client';

import { Grain, MeshGradient, ShaderScene, type ShaderSceneProps } from '@camp-dev/shaders';

export function GeneratorTest(props: Omit<ShaderSceneProps, 'children'>) {
  return (
    <ShaderScene {...props}>
      <MeshGradient speed={0.4} />
      <Grain intensity={0.08} />
    </ShaderScene>
  );
}
`);
  });

  it('prints a prop the loaded preset sets, even at its library default', () => {
    expect(generate('Coarse')).toContain('<Grain blend="additive" intensity={0.08} />');
  });

  it('prints a prop that has moved off its library default', () => {
    const output = generate('Default', (state) => {
      state.base = { ...state.base, frequency: 7 };
    });

    expect(output).toContain('<MeshGradient frequency={7} speed={0.4} />');
  });

  it('leaves out a prop that sits at its library default', () => {
    const output = generate('Default', (state) => {
      state.grain = { ...state.grain, speed: 0.3 };
    });

    expect(output).not.toContain('speed={0.3}');
  });

  it('rounds slider noise and compares numbers after rounding', () => {
    const output = generate('Default', (state) => {
      state.base = { ...state.base, speed: 0.1 + 0.2, frequency: 5.000000001 };
    });

    expect(output).toContain('<MeshGradient speed={0.3} />');
  });

  it('prints strings as JSX strings and arrays in braces', () => {
    const output = generate('Default', (state) => {
      state.grain = { ...state.grain, blend: 'subtractive' };
      state.base = { ...state.base, palettes: [['#fff', '#eee', '#ddd', '#ccc']] };
    });

    expect(output).toContain(
      `<MeshGradient palettes={[['#fff', '#eee', '#ddd', '#ccc']]} speed={0.4} />`,
    );
    expect(output).toContain('<Grain blend="subtractive" intensity={0.08} />');
  });

  it("puts the document's scene props before the spread", () => {
    const output = generateComposition({
      composition: { ...composition, scene: { scrollPush: true, maxFPS: 30 } },
      preset: 'Default',
      state: presetProps(composition, defaults, 'Default'),
      defaults,
    });

    expect(output).toContain('<ShaderScene maxFPS={30} scrollPush={true} {...props}>');
  });

  it('imports each component once, sorted with ShaderScene', () => {
    const output = generateComposition({
      composition: {
        ...composition,
        stack: [
          { id: 'one', component: 'Vignette', props: {} },
          { id: 'two', component: 'Dither', props: {} },
          { id: 'three', component: 'Vignette', props: {} },
        ],
      },
      preset: 'Default',
      state: { one: {}, two: {}, three: {} },
      defaults: {},
    });

    expect(output).toContain(
      "import { Dither, ShaderScene, type ShaderSceneProps, Vignette } from '@camp-dev/shaders';",
    );
    expect(output).toContain('<Vignette />\n      <Dither />\n      <Vignette />');
  });
});

describe('props with no library default', () => {
  // FractalNoise's contrast follows its style, so the library has no
  // default for it. The panel seeds one from the style, and the file prints
  // it once it differs from the style's own.
  const noise = defineComposition({
    slug: 'no-default-test',
    title: 'No default',
    description: 'A FractalNoise for the no-default rule.',
    stack: [{ id: 'noise', component: 'FractalNoise', props: {} }],
    presets: [],
    controls: [],
  });
  const noiseDefaults = { noise: { style: 'clouds', scale: 3 } };
  const seed: SeedFields = (_entry, props) => ({
    contrast: props.style === 'veins' ? 1 : 1.75,
    ...props,
  });
  const loaded = { noise: { style: 'clouds', scale: 3, contrast: 1.75 } };

  it("leaves the prop out while it holds the style's value", () => {
    const output = generateComposition({
      composition: noise,
      preset: 'Default',
      state: loaded,
      defaults: noiseDefaults,
      seed,
    });

    expect(output).toContain('<FractalNoise />');
  });

  it('prints the prop once it moves', () => {
    const output = generateComposition({
      composition: noise,
      preset: 'Default',
      state: { noise: { ...loaded.noise, contrast: 2 } },
      defaults: noiseDefaults,
      seed,
    });

    expect(output).toContain('<FractalNoise contrast={2} />');
  });

  it('prints the loaded value once the style it followed changes', () => {
    const output = generateComposition({
      composition: noise,
      preset: 'Default',
      state: { noise: { ...loaded.noise, style: 'veins' } },
      defaults: noiseDefaults,
      seed,
    });

    expect(output).toContain('<FractalNoise contrast={1.75} style="veins" />');
  });
});

describe('seeded library defaults', () => {
  // FlutedGlass's crossSection defaults to the name 'round', which the panel
  // seeds as its dial value so the slider can edit it.
  it('leaves the seeded default out', () => {
    const glass = defineComposition({
      slug: 'seeded-default-test',
      title: 'Seeded default',
      description: 'A FlutedGlass for the seeded-default rule.',
      stack: [{ id: 'glass', component: 'FlutedGlass', props: {} }],
      presets: [],
      controls: [],
    });

    const output = generateComposition({
      composition: glass,
      preset: 'Default',
      state: { glass: { crossSection: 0.5 } },
      defaults: { glass: { crossSection: 'round' } },
      seed: (_entry, props) =>
        props.crossSection === 'round' ? { ...props, crossSection: 0.5 } : props,
    });

    expect(output).toContain('<FlutedGlass />');
  });
});

describe('stop positions', () => {
  // The store writes out the positions the library would space a gradient's
  // stops at, so its fields can show them. Untouched, they still match the
  // library default.
  it('leaves untouched gradient stops out', () => {
    const gradient = defineComposition({
      slug: 'stops-test',
      title: 'Stops',
      description: 'A LinearGradient for the stop-position rule.',
      stack: [{ id: 'base', component: 'LinearGradient', props: {} }],
      presets: [],
      controls: [],
    });
    const gradientDefaults = { base: { stops: [{ color: '#000' }, { color: '#fff' }] } };

    const output = generateComposition({
      composition: gradient,
      preset: 'Default',
      state: presetProps(gradient, gradientDefaults, 'Default'),
      defaults: gradientDefaults,
    });

    expect(output).toContain('<LinearGradient />');
  });
});

describe('names', () => {
  it('turns the title into the component name and a preset into a file name', () => {
    expect(pascalCase('Late summer haze')).toBe('LateSummerHaze');
    expect(kebabCase('Late Summer, Again')).toBe('late-summer-again');
  });
});

// ----------------------------------------------------------------------------
// Prettier's line breaking
// ----------------------------------------------------------------------------

const COMPONENT_NAMES: ComponentName[] = [
  'Aurora',
  'Blobs',
  'ConicGradient',
  'CursorRipple',
  'CursorSmudge',
  'CursorSpotlight',
  'Dissolve',
  'Dither',
  'DotField',
  'FlutedGlass',
  'FractalNoise',
  'GodRays',
  'Grain',
  'LedWall',
  'LinearGradient',
  'LiquidGradient',
  'MeshGradient',
  'RadialGradient',
  'RadialWipe',
  'SimplexNoise',
  'Vignette',
  'Voronoi',
  'WaveLines',
];

async function prettierFormat(source: string): Promise<string> {
  // A file name beside this one, so Prettier resolves the repo's config and
  // parses as TSX. Nothing is written there.
  const filepath = join(fileURLToPath(new URL('.', import.meta.url)), 'prettier-check.tsx');
  const options = await resolveConfig(filepath);

  return format(source, { ...options, filepath });
}

describe('Prettier style', () => {
  // Setting every default prints each component's longest props: stop
  // lists, palettes, WaveLines' nested color pairs, and position tuples.
  it.each(COMPONENT_NAMES)('leaves %s with every default set as it is', async (name) => {
    const slug = slugForComponentName(name);

    if (slug === undefined) throw new Error(`No slug for ${name}`);

    const props = await getComponentDefaults(slug);
    const document = {
      slug: 'prettier-check',
      title: 'Prettier check',
      description: 'Every default of one component.',
      stack: [{ id: 'entry', component: name, props }],
      presets: [],
      controls: [],
    } as unknown as Composition;
    const output = generateComposition({
      composition: document,
      preset: 'Default',
      state: { entry: props },
      defaults: { entry: props },
    });

    expect(output).toBe(await prettierFormat(output));
  });

  it('leaves a long import line and a long single attribute as they are', async () => {
    const stack = COMPONENT_NAMES.slice(0, 6).map((name, index) => ({
      id: `entry${index}`,
      component: name,
      props: {},
    }));
    const output = generateComposition({
      composition: {
        ...composition,
        stack: [
          ...stack,
          {
            id: 'wide',
            component: 'LinearGradient',
            props: { stops: [{ color: 'oklch(0.5 0.1 250)', position: 0.25 }] },
          },
        ],
      } as unknown as Composition,
      preset: 'Default',
      state: {
        wide: {
          stops: [
            { color: 'oklch(0.5 0.1 250)', position: 0.25 },
            { color: 'oklch(0.6 0.12 260)', position: 0.5 },
            { color: 'oklch(0.7 0.14 270)', position: 1 },
          ],
        },
      },
      defaults: {},
    });

    expect(output).toBe(await prettierFormat(output));
  });
});

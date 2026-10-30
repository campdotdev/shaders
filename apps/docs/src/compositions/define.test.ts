// @vitest-environment node
/**
 * Type tests for defineComposition. Each @ts-expect-error below is one of the
 * mistakes the document's types exist to catch, so `pnpm typecheck` fails if
 * any of them starts compiling. The runtime half only checks that a valid
 * document comes back unchanged, since defineComposition does nothing else.
 */
import type { AnimatableProp, PositionProp } from '@camp-dev/shaders';
import { describe, expect, expectTypeOf, it } from 'vitest';

import { defineComposition, type LiteralPropsOf } from './define';

const base = { slug: 'test', title: 'Test', description: 'A test composition.' };

describe('LiteralPropsOf', () => {
  // No public component takes a callback today, so a props shape of its own
  // stands in for one that will.
  it('drops callback props and the signal half of an animatable prop', () => {
    interface Props {
      speed?: AnimatableProp<number>;
      center?: PositionProp;
      stops?: Array<{ color: string; position?: number }>;
      onDone?: () => void;
    }

    expectTypeOf<LiteralPropsOf<Props>>().toEqualTypeOf<{
      readonly speed?: number;
      readonly center?: readonly [number, number] | 'cursor';
      readonly stops?: ReadonlyArray<{ readonly color: string; readonly position?: number }>;
    }>();
  });
});

describe('defineComposition', () => {
  it('returns a valid document unchanged', () => {
    const document = {
      ...base,
      stack: [
        {
          id: 'base',
          component: 'MeshGradient',
          props: {
            speed: 0.4,
            palettes: [
              ['#000', '#111', '#222', '#333'],
              ['#444', '#555', '#666', '#777'],
            ],
          },
        },
        { id: 'grain', component: 'Grain', props: { intensity: 0.08, blend: 'subtractive' } },
        { id: 'wipe', component: 'RadialWipe', props: { center: 'cursor' } },
      ],
      scene: { scrollPush: true, maxFPS: 30 },
      presets: [{ name: 'Still', props: { base: { speed: 0 }, grain: { intensity: 0 } } }],
      controls: [
        {
          kind: 'slider',
          entry: 'base',
          path: 'speed',
          label: 'Drift',
          min: 0,
          max: 2,
          step: 0.01,
        },
        {
          kind: 'number',
          entry: 'grain',
          path: 'intensity',
          label: 'Grain',
          min: 0,
          max: 1,
          step: 0.01,
        },
        { kind: 'color', entry: 'base', path: 'palettes.0.2', label: 'Accent' },
        {
          kind: 'select',
          entry: 'grain',
          path: 'blend',
          label: 'Blend',
          options: [
            { label: 'Additive', value: 'additive' },
            { label: 'Subtractive', value: 'subtractive' },
          ],
        },
      ],
    } as const;

    expect(defineComposition(document)).toBe(document);
  });

  it('rejects a component name the component map lacks', () => {
    defineComposition({
      ...base,
      // @ts-expect-error -- 'MeshGradiant' is not a public Source or Effect
      stack: [{ id: 'base', component: 'MeshGradiant', props: {} }],
      presets: [],
      controls: [],
    });
  });

  it('rejects a prop the component does not have', () => {
    defineComposition({
      ...base,
      // @ts-expect-error -- MeshGradient has no `sped` prop
      stack: [{ id: 'base', component: 'MeshGradient', props: { speed: 1, sped: 2 } }],
      presets: [],
      controls: [],
    });
  });

  it('rejects a value of the wrong type', () => {
    defineComposition({
      ...base,
      // @ts-expect-error -- speed is a number
      stack: [{ id: 'base', component: 'MeshGradient', props: { speed: 'fast' } }],
      presets: [],
      controls: [],
    });
  });

  it('rejects a signal where a literal belongs', () => {
    const signal = { get: () => 1, on: () => () => undefined };

    defineComposition({
      ...base,
      // @ts-expect-error -- a signal is not a literal
      stack: [{ id: 'base', component: 'MeshGradient', props: { speed: signal } }],
      presets: [],
      controls: [],
    });
  });

  it('rejects a preset that names an entry the stack lacks', () => {
    defineComposition({
      ...base,
      stack: [{ id: 'base', component: 'MeshGradient', props: {} }],
      // @ts-expect-error -- the stack has no `grain` entry
      presets: [{ name: 'Loud', props: { grain: { intensity: 1 } } }],
      controls: [],
    });
  });

  it('rejects a preset prop the entry does not have', () => {
    defineComposition({
      ...base,
      stack: [{ id: 'base', component: 'MeshGradient', props: {} }],
      // @ts-expect-error -- MeshGradient has no `intensity` prop
      presets: [{ name: 'Loud', props: { base: { intensity: 1 } } }],
      controls: [],
    });
  });

  it('rejects a control that names an entry the stack lacks', () => {
    defineComposition({
      ...base,
      stack: [{ id: 'base', component: 'MeshGradient', props: {} }],
      presets: [],
      controls: [
        {
          kind: 'slider',
          // @ts-expect-error -- the stack has no `grain` entry
          entry: 'grain',
          path: 'speed',
          label: 'Grain',
          min: 0,
          max: 1,
          step: 0.1,
        },
      ],
    });
  });

  it('rejects a control path the entry does not have', () => {
    defineComposition({
      ...base,
      stack: [{ id: 'base', component: 'MeshGradient', props: {} }],
      presets: [],
      controls: [
        // @ts-expect-error -- MeshGradient has no `sped` prop
        { kind: 'slider', entry: 'base', path: 'sped', label: 'Drift', min: 0, max: 2, step: 0.1 },
      ],
    });
  });

  it('rejects a slider on a prop that is not a number', () => {
    defineComposition({
      ...base,
      stack: [{ id: 'base', component: 'MeshGradient', props: {} }],
      presets: [],
      controls: [
        // @ts-expect-error -- colorSpace is a string union
        {
          kind: 'slider',
          entry: 'base',
          path: 'colorSpace',
          label: 'Space',
          min: 0,
          max: 2,
          step: 0.1,
        },
      ],
    });
  });

  it('rejects a color control on a prop that is not a string', () => {
    defineComposition({
      ...base,
      stack: [{ id: 'base', component: 'MeshGradient', props: {} }],
      presets: [],
      // @ts-expect-error -- speed is a number
      controls: [{ kind: 'color', entry: 'base', path: 'speed', label: 'Speed' }],
    });
  });

  it('rejects a select option outside the prop union', () => {
    defineComposition({
      ...base,
      stack: [{ id: 'grain', component: 'Grain', props: {} }],
      presets: [],
      controls: [
        {
          kind: 'select',
          entry: 'grain',
          path: 'blend',
          label: 'Blend',
          // @ts-expect-error -- 'overlay' is not a GrainBlend
          options: [{ label: 'Overlay', value: 'overlay' }],
        },
      ],
    });
  });

  it('rejects a slider without its range', () => {
    defineComposition({
      ...base,
      stack: [{ id: 'base', component: 'MeshGradient', props: {} }],
      presets: [],
      // @ts-expect-error -- a slider needs min, max, and step
      controls: [{ kind: 'slider', entry: 'base', path: 'speed', label: 'Drift' }],
    });
  });
});

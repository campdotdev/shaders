// @vitest-environment node
/**
 * The Customize panel's store: library defaults, then the stack's props, then
 * the loaded preset. These cover what a visitor sees through the panel:
 * loading a preset starts from the defaults rather than from earlier edits,
 * the picker keeps naming the loaded preset after an edit, and Reset goes
 * back to that preset rather than to Default.
 */
import { describe, expect, it } from 'vitest';

import { defineComposition } from './define';
import { createCompositionStore, DEFAULT_PRESET, presetProps, withStopPositions } from './store';

const composition = defineComposition({
  slug: 'store-test',
  title: 'Store Test',
  description: 'A stack for the store tests.',
  stack: [
    { id: 'base', component: 'MeshGradient', props: { speed: 0.4 } },
    { id: 'grain', component: 'Grain', props: { intensity: 0.08 } },
  ],
  presets: [
    { name: 'Still', props: { base: { speed: 0 } } },
    { name: 'Coarse', props: { grain: { intensity: 0.3, blend: 'subtractive' } } },
  ],
  controls: [],
});

const defaults = {
  base: { speed: 2, frequency: 5 },
  grain: { intensity: 0.15, speed: 0.3, blend: 'additive' },
};

describe('presetProps', () => {
  it('puts the stack props over the library defaults for Default', () => {
    expect(presetProps(composition, defaults, DEFAULT_PRESET)).toEqual({
      base: { speed: 0.4, frequency: 5 },
      grain: { intensity: 0.08, speed: 0.3, blend: 'additive' },
    });
  });

  it("puts a preset's override over the stack props", () => {
    expect(presetProps(composition, defaults, 'Coarse')).toEqual({
      base: { speed: 0.4, frequency: 5 },
      grain: { intensity: 0.3, speed: 0.3, blend: 'subtractive' },
    });
  });

  it('throws on a preset the composition lacks', () => {
    expect(() => presetProps(composition, defaults, 'Loud')).toThrow(/Loud/);
  });
});

describe('createCompositionStore', () => {
  it('starts on Default', () => {
    const store = createCompositionStore(composition, defaults);

    expect(store.getPreset()).toBe(DEFAULT_PRESET);
    expect(store.getSnapshot()).toEqual(presetProps(composition, defaults, DEFAULT_PRESET));
  });

  it('resets to the defaults before it applies a preset', () => {
    const store = createCompositionStore(composition, defaults);

    store.setAtPath(['grain', 'intensity'], 0.9);
    store.loadPreset('Still');

    expect(store.getSnapshot()).toEqual({
      base: { speed: 0, frequency: 5 },
      grain: { intensity: 0.08, speed: 0.3, blend: 'additive' },
    });
  });

  it('keeps the loaded preset after an edit', () => {
    const store = createCompositionStore(composition, defaults);

    store.loadPreset('Coarse');
    store.setAtPath(['base', 'speed'], 1.5);

    expect(store.getPreset()).toBe('Coarse');
  });

  it('resets to the loaded preset, not to Default', () => {
    const store = createCompositionStore(composition, defaults);

    store.loadPreset('Coarse');
    store.setAtPath(['grain', 'intensity'], 0.9);
    store.reset();

    expect(store.getSnapshot()).toEqual(presetProps(composition, defaults, 'Coarse'));
  });

  it('tells subscribers when a preset loads', () => {
    const store = createCompositionStore(composition, defaults);
    let calls = 0;

    store.subscribe(() => {
      calls += 1;
    });
    store.loadPreset('Still');

    expect(calls).toBe(1);
  });
});

describe('withStopPositions', () => {
  it('writes out the positions the library spaces evenly, for a gradient', () => {
    const stops = [{ color: '#000' }, { color: '#888', position: 0.2 }, { color: '#fff' }];

    expect(withStopPositions('LinearGradient', { stops })).toEqual({
      stops: [
        { color: '#000', position: 0 },
        { color: '#888', position: 0.2 },
        { color: '#fff', position: 1 },
      ],
    });
  });

  // Blobs' fields edit colors only, so its stops keep the shape they came in.
  it('leaves a component whose fields edit no stop position alone', () => {
    const stops = [{ color: '#000' }, { color: '#fff' }];

    expect(withStopPositions('Blobs', { stops })).toEqual({ stops });
  });
});

describe('seeding the fields', () => {
  const seeded = createCompositionStore(composition, defaults, (entry, props) =>
    entry.component === 'Grain' ? { grit: 1, ...props } : props,
  );

  it('seeds every preset it loads, and Reset returns to the seeded props', () => {
    expect(seeded.getSnapshot().grain).toMatchObject({ grit: 1, intensity: 0.08 });

    seeded.loadPreset('Coarse');

    expect(seeded.getSnapshot().grain).toMatchObject({ grit: 1, intensity: 0.3 });

    seeded.setAtPath(['grain', 'grit'], 2);
    seeded.reset();

    expect(seeded.getSnapshot().grain).toMatchObject({ grit: 1, intensity: 0.3 });
  });
});

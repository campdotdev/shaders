import { afterEach, describe, expect, it } from 'vitest';

import {
  __registerMigrationForTests,
  parsePreset,
  PRESET_VERSION,
  PresetError,
  presetFrom,
  serializePreset,
} from './preset';
import type { Preset, PresetEdge, PresetNode } from './preset';
import { DEFAULT_RAMP_STOPS, defaultParamsOf, NODE_SPECS } from './registry';
import type { SpecId } from './registry';

/**
 * One node per registry spec, wired into a single linear chain wherever the
 * spec's inputs make that possible. Every field/color port on every spec
 * gets exercised at least once, which is what the round-trip test needs to
 * prove the format survives a full tour of the vocabulary, not just the
 * specs that happen to have simple params.
 */
function buildFullPreset(): Preset {
  const specIds = Object.keys(NODE_SPECS) as SpecId[];
  const nodes: PresetNode[] = specIds.map((spec, index) => ({
    id: spec,
    spec,
    position: { x: index * 160, y: 0 },
    params: defaultParamsOf(spec),
  }));
  const edges: PresetEdge[] = [
    { source: 'gradient', target: 'warp', targetHandle: 'source' },
    { source: 'noise', target: 'warp', targetHandle: 'by' },
    { source: 'warp', target: 'curve', targetHandle: 'in' },
    { source: 'curve', target: 'blend', targetHandle: 'in' },
    { source: 'fractalNoise', target: 'blend', targetHandle: 'with' },
    { source: 'blend', target: 'colorRamp', targetHandle: 'in' },
    { source: 'colorRamp', target: 'tone', targetHandle: 'in' },
    { source: 'tone', target: 'levels', targetHandle: 'in' },
    { source: 'levels', target: 'vignette', targetHandle: 'in' },
    { source: 'vignette', target: 'grain', targetHandle: 'in' },
    { source: 'grain', target: 'output', targetHandle: 'in' },
  ];

  return presetFrom(nodes, edges);
}

describe('serializePreset / parsePreset round trip', () => {
  it('is stable across a parse/serialize cycle for a preset touching every spec', () => {
    const preset = buildFullPreset();
    const once = serializePreset(preset);
    const twice = serializePreset(parsePreset(once));

    expect(twice).toBe(once);
  });

  it('writes 2-space indented JSON with a stable field order', () => {
    const json = serializePreset(presetFrom([], []));

    expect(json).toBe(JSON.stringify({ version: PRESET_VERSION, nodes: [], edges: [] }, null, 2));
  });
});

describe('parsePreset validation failures', () => {
  it('throws on an unknown node spec', () => {
    const json = JSON.stringify({
      version: PRESET_VERSION,
      nodes: [{ id: 'n1', spec: 'foo', position: { x: 0, y: 0 }, params: {} }],
      edges: [],
    });

    expect(() => parsePreset(json)).toThrow(PresetError);
    expect(() => parsePreset(json)).toThrow(
      'Unknown node type "foo" — this preset may come from a newer editor.',
    );
  });

  it('throws on a preset version newer than this editor supports', () => {
    const json = JSON.stringify({ version: PRESET_VERSION + 1, nodes: [], edges: [] });

    expect(() => parsePreset(json)).toThrow(PresetError);
    expect(() => parsePreset(json)).toThrow(
      `This preset needs a newer editor (preset version ${PRESET_VERSION + 1}, editor supports ${PRESET_VERSION}).`,
    );
  });

  it('throws on a non-integer version', () => {
    const json = JSON.stringify({ version: 1.5, nodes: [], edges: [] });

    expect(() => parsePreset(json)).toThrow(PresetError);
  });

  it('throws on a negative version instead of spinning through the migration walk', () => {
    const json = JSON.stringify({ version: -1, nodes: [], edges: [] });

    expect(() => parsePreset(json)).toThrow(PresetError);
    expect(() => parsePreset(json)).toThrow('Preset version must not be negative (got -1).');
  });

  it('throws on duplicate node ids instead of letting the later node win silently', () => {
    const json = JSON.stringify({
      version: PRESET_VERSION,
      nodes: [
        { id: 'x', spec: 'gradient', position: { x: 0, y: 0 }, params: {} },
        { id: 'x', spec: 'output', position: { x: 0, y: 0 }, params: {} },
      ],
      edges: [],
    });

    expect(() => parsePreset(json)).toThrow(PresetError);
    expect(() => parsePreset(json)).toThrow('Duplicate node id "x"');
  });

  it('throws when an edge targets a handle the target spec does not have', () => {
    const json = JSON.stringify({
      version: PRESET_VERSION,
      nodes: [{ id: 'o1', spec: 'output', position: { x: 0, y: 0 }, params: {} }],
      edges: [{ source: 'o1', target: 'o1', targetHandle: 'nope' }],
    });

    expect(() => parsePreset(json)).toThrow(PresetError);
  });

  it('throws when an edge references a node id that does not exist', () => {
    const json = JSON.stringify({
      version: PRESET_VERSION,
      nodes: [{ id: 'o1', spec: 'output', position: { x: 0, y: 0 }, params: {} }],
      edges: [{ source: 'ghost', target: 'o1', targetHandle: 'in' }],
    });

    expect(() => parsePreset(json)).toThrow(PresetError);
  });
});

describe('parsePreset coercions', () => {
  it('clamps an out-of-range slider value into [min, max]', () => {
    const json = JSON.stringify({
      version: PRESET_VERSION,
      nodes: [{ id: 'g1', spec: 'gradient', position: { x: 0, y: 0 }, params: { angle: 999 } }],
      edges: [],
    });
    const preset = parsePreset(json);

    expect(NODE_SPECS.gradient.params[0]!.kind).toBe('slider');
    // gradient's only param is angle, min 0 max 360 -- 999 clamps to 360.
    expect(preset.nodes[0]!.params.angle).toBe(360);
  });

  it('resets a select value outside the option list to the default', () => {
    const json = JSON.stringify({
      version: PRESET_VERSION,
      nodes: [{ id: 'b1', spec: 'blend', position: { x: 0, y: 0 }, params: { mode: 'nonsense' } }],
      edges: [],
    });
    const preset = parsePreset(json);

    expect(preset.nodes[0]!.params.mode).toBe('mix');
  });

  it('fills a missing param id from the spec default', () => {
    const json = JSON.stringify({
      version: PRESET_VERSION,
      nodes: [{ id: 'g1', spec: 'gradient', position: { x: 0, y: 0 }, params: {} }],
      edges: [],
    });
    const preset = parsePreset(json);

    expect(preset.nodes[0]!.params).toEqual(defaultParamsOf('gradient'));
  });

  it('drops unknown param ids', () => {
    const json = JSON.stringify({
      version: PRESET_VERSION,
      nodes: [
        {
          id: 'g1',
          spec: 'gradient',
          position: { x: 0, y: 0 },
          params: { angle: 90, mystery: 'nope' },
        },
      ],
      edges: [],
    });
    const preset = parsePreset(json);

    expect(preset.nodes[0]!.params).toEqual({ angle: 90 });
  });

  it('resets a malformed ramp param to the default, non-array case', () => {
    const json = JSON.stringify({
      version: PRESET_VERSION,
      nodes: [
        {
          id: 'r1',
          spec: 'colorRamp',
          position: { x: 0, y: 0 },
          params: { stops: 'not-an-array' },
        },
      ],
      edges: [],
    });
    const preset = parsePreset(json);

    expect(preset.nodes[0]!.params.stops).toEqual(DEFAULT_RAMP_STOPS);
  });

  it('resets a malformed ramp param to the default, bad element shape', () => {
    const json = JSON.stringify({
      version: PRESET_VERSION,
      nodes: [
        {
          id: 'r1',
          spec: 'colorRamp',
          position: { x: 0, y: 0 },
          params: { stops: [{ color: '#fff' }, { position: 1 }] },
        },
      ],
      edges: [],
    });
    const preset = parsePreset(json);

    expect(preset.nodes[0]!.params.stops).toEqual(DEFAULT_RAMP_STOPS);
  });

  it('clamps ramp stop positions into 0..1 without resetting the whole ramp', () => {
    const json = JSON.stringify({
      version: PRESET_VERSION,
      nodes: [
        {
          id: 'r1',
          spec: 'colorRamp',
          position: { x: 0, y: 0 },
          params: {
            stops: [
              { color: '#000000', position: -5 },
              { color: '#ffffff', position: 5 },
            ],
          },
        },
      ],
      edges: [],
    });
    const preset = parsePreset(json);

    expect(preset.nodes[0]!.params.stops).toEqual([
      { color: '#000000', position: 0 },
      { color: '#ffffff', position: 1 },
    ]);
  });
});

describe('migrations', () => {
  let unregister: (() => void) | undefined;

  afterEach(() => {
    unregister?.();
    unregister = undefined;
  });

  it('walks a registered no-op migration and parses a version 0 preset', () => {
    unregister = __registerMigrationForTests(0, (preset) => preset);

    const json = JSON.stringify({ version: 0, nodes: [], edges: [] });
    const preset = parsePreset(json);

    expect(preset.version).toBe(PRESET_VERSION);
  });
});

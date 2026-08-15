import { describe, expect, it } from 'vitest';

import type { CardNodeType } from './CardNode';
import {
  flowFromPreset,
  presetFromFlow,
  pushPresetToStore,
  STARTER_FLOW_EDGES,
  STARTER_FLOW_NODES,
} from './flow-preset';
import type { ParamStore } from './param-store';
import { parsePreset, serializePreset } from './preset';
import type { Preset } from './preset';

/** One canvas -> preset -> canvas -> preset lap, as a serialized string. */
function relap(nodes: CardNodeType[], edges = STARTER_FLOW_EDGES): string {
  const restored = flowFromPreset(parsePreset(serializePreset(presetFromFlow(nodes, edges))));

  return serializePreset(presetFromFlow(restored.nodes, restored.edges));
}

describe('preset round trip', () => {
  // The invariant undo/redo rests on: a restored canvas re-serializes to the
  // string it was restored FROM, so the record that fires after an undo is
  // dropped as identical instead of landing as a new entry (which would clear
  // the redo stack). Any adapter that loses a field breaks redo, not just
  // fidelity -- which is why this is the first test in the file.
  it('re-serializes a restored canvas to the same string', () => {
    const original = serializePreset(presetFromFlow(STARTER_FLOW_NODES, STARTER_FLOW_EDGES));

    expect(relap(STARTER_FLOW_NODES)).toBe(original);
  });

  it('survives a moved card and an edited slider', () => {
    const edited = STARTER_FLOW_NODES.map((node) =>
      node.id === 'noise-1'
        ? {
            ...node,
            position: { x: 123.5, y: -47.25 },
            data: { ...node.data, params: { ...node.data.params, scale: 7.5 } },
          }
        : node,
    );
    const original = serializePreset(presetFromFlow(edited, STARTER_FLOW_EDGES));

    expect(relap(edited)).toBe(original);
  });

  it('leaves runtime-only state out of the preset', () => {
    const dressed = STARTER_FLOW_NODES.map((node) => ({
      ...node,
      selected: true,
      dragging: true,
      data: { ...node.data, open: true },
    }));

    expect(serializePreset(presetFromFlow(dressed, STARTER_FLOW_EDGES))).toBe(
      serializePreset(presetFromFlow(STARTER_FLOW_NODES, STARTER_FLOW_EDGES)),
    );
  });

  it('restores cards unselected with their params panel shut', () => {
    const restored = flowFromPreset(presetFromFlow(STARTER_FLOW_NODES, STARTER_FLOW_EDGES));

    expect(restored.nodes.every((node) => node.data.open === undefined)).toBe(true);
    expect(restored.nodes.every((node) => node.selected === undefined)).toBe(true);
  });

  it('keeps the Output card undeletable through a restore', () => {
    const restored = flowFromPreset(presetFromFlow(STARTER_FLOW_NODES, STARTER_FLOW_EDGES));

    expect(restored.nodes.find((node) => node.data.spec === 'output')?.deletable).toBe(false);
  });

  it('gives every restored wire a distinct id', () => {
    const restored = flowFromPreset(presetFromFlow(STARTER_FLOW_NODES, STARTER_FLOW_EDGES));
    const ids = new Set(restored.edges.map((edge) => edge.id));

    expect(ids.size).toBe(restored.edges.length);
  });
});

describe('pushPresetToStore', () => {
  // A stub rather than the real store: ParamStore pulls in three/tsl, and all
  // this needs to observe is WHICH values get written on a restore.
  function stubStore() {
    const sliders: Array<[string, string, number]> = [];
    const positions: Array<[string, number, number]> = [];
    const colors: string[] = [];

    const store = {
      set: (nodeId: string, paramId: string, value: number) =>
        sliders.push([nodeId, paramId, value]),
      setStopPosition: (nodeId: string, index: number, value: number) =>
        positions.push([nodeId, index, value]),
      setStopColor: (nodeId: string) => colors.push(nodeId),
    } as unknown as ParamStore;

    return { store, sliders, positions, colors };
  }

  const preset = (): Preset =>
    parsePreset(serializePreset(presetFromFlow(STARTER_FLOW_NODES, STARTER_FLOW_EDGES)));

  it('writes every slider value through the store', () => {
    const { store, sliders } = stubStore();

    pushPresetToStore(preset(), store);

    expect(sliders).toContainEqual(['noise-1', 'scale', expect.any(Number)]);
    expect(sliders.length).toBeGreaterThan(0);
  });

  it('writes every ramp stop position and color', () => {
    const { store, positions, colors } = stubStore();

    pushPresetToStore(preset(), store);

    // The starter graph's one ramp card, one write per stop of the three-stop
    // default, indexed from 0 — the same keying ParamStore uses.
    expect(positions.filter(([nodeId]) => nodeId === 'ramp-1').map(([, index]) => index)).toEqual([
      0, 1, 2,
    ]);
    expect(colors.filter((nodeId) => nodeId === 'ramp-1')).toHaveLength(3);
  });

  it('writes nothing for a card with no live-driven params', () => {
    const { store, sliders, positions } = stubStore();
    const outputOnly: Preset = {
      version: 1,
      nodes: [{ id: 'output-x', spec: 'output', position: { x: 0, y: 0 }, params: {} }],
      edges: [],
    };

    pushPresetToStore(outputOnly, store);

    expect(sliders).toHaveLength(0);
    expect(positions).toHaveLength(0);
  });
});

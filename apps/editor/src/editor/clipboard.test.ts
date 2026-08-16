import { describe, expect, it } from 'vitest';

import { PASTE_OFFSET, remapForPaste, selectionToPreset } from './clipboard';
import type { PresetEdge, PresetNode } from './preset';
import { PRESET_VERSION, presetFrom } from './preset';

/** Small fixture: gradient -> colorRamp -> output, plus an unwired noise node
    sitting off to the side. Covers a wired pair, a singleton output, and a
    node that isn't part of either selection under test. */
function buildNodes(): PresetNode[] {
  return [
    { id: 'gradient-1', spec: 'gradient', position: { x: 0, y: 0 }, params: {} },
    { id: 'colorRamp-1', spec: 'colorRamp', position: { x: 100, y: 0 }, params: {} },
    { id: 'output', spec: 'output', position: { x: 200, y: 0 }, params: {} },
    { id: 'noise-1', spec: 'noise', position: { x: 0, y: 100 }, params: {} },
  ];
}

function buildEdges(): PresetEdge[] {
  return [
    { source: 'gradient-1', target: 'colorRamp-1', targetHandle: 'in' },
    { source: 'colorRamp-1', target: 'output', targetHandle: 'in' },
  ];
}

describe('selectionToPreset', () => {
  it('keeps the edge between two selected, wired nodes', () => {
    const nodes = buildNodes();
    const edges = buildEdges();
    const selectedIds = new Set(['gradient-1', 'colorRamp-1']);

    const preset = selectionToPreset(nodes, edges, selectedIds);

    expect(preset.nodes.map((node) => node.id).sort()).toEqual(['colorRamp-1', 'gradient-1']);
    expect(preset.edges).toEqual([
      { source: 'gradient-1', target: 'colorRamp-1', targetHandle: 'in' },
    ]);
  });

  it('drops an edge to a node outside the selection', () => {
    const nodes = buildNodes();
    const edges = buildEdges();
    const selectedIds = new Set(['gradient-1']);

    const preset = selectionToPreset(nodes, edges, selectedIds);

    expect(preset.nodes.map((node) => node.id)).toEqual(['gradient-1']);
    expect(preset.edges).toEqual([]);
  });

  it('excludes an output node from the selection, and drops its edges', () => {
    const nodes = buildNodes();
    const edges = buildEdges();
    const selectedIds = new Set(['gradient-1', 'colorRamp-1', 'output']);

    const preset = selectionToPreset(nodes, edges, selectedIds);

    expect(preset.nodes.map((node) => node.id).sort()).toEqual(['colorRamp-1', 'gradient-1']);
    expect(preset.edges).toEqual([
      { source: 'gradient-1', target: 'colorRamp-1', targetHandle: 'in' },
    ]);
  });

  it('stamps the current preset version', () => {
    const nodes = buildNodes();
    const selectedIds = new Set(['noise-1']);

    const preset = selectionToPreset(nodes, [], selectedIds);

    expect(preset.version).toBe(PRESET_VERSION);
  });
});

describe('remapForPaste', () => {
  it('assigns ids absent from takenIds', () => {
    const preset = presetFrom(
      [{ id: 'gradient-1', spec: 'gradient', position: { x: 0, y: 0 }, params: {} }],
      [],
    );
    const takenIds = new Set(['gradient-1', 'gradient-2']);

    const { nodes } = remapForPaste(preset, takenIds);

    expect(nodes).toHaveLength(1);
    const [pastedNode] = nodes;

    expect(takenIds.has(pastedNode!.id)).toBe(false);
    expect(pastedNode!.id).toBe('gradient-3');
  });

  it('keeps internal wiring consistent -- edges point at the remapped ids', () => {
    const preset = presetFrom(
      [
        { id: 'gradient-1', spec: 'gradient', position: { x: 0, y: 0 }, params: {} },
        { id: 'colorRamp-1', spec: 'colorRamp', position: { x: 100, y: 0 }, params: {} },
      ],
      [{ source: 'gradient-1', target: 'colorRamp-1', targetHandle: 'in' }],
    );

    const { nodes, edges } = remapForPaste(preset, new Set());

    const remappedIds = new Set(nodes.map((node) => node.id));

    expect(remappedIds.size).toBe(2);
    expect(edges).toHaveLength(1);
    const [pastedEdge] = edges;

    expect(remappedIds.has(pastedEdge!.source)).toBe(true);
    expect(remappedIds.has(pastedEdge!.target)).toBe(true);
    expect(pastedEdge).toEqual({
      source: nodes.find((node) => node.spec === 'gradient')!.id,
      target: nodes.find((node) => node.spec === 'colorRamp')!.id,
      targetHandle: 'in',
    });
  });

  it('deep-copies params so a pasted node shares no references with its source', () => {
    const sourceParams = {
      stops: [
        { color: '#000000', position: 0 },
        { color: '#ffffff', position: 1 },
      ],
    };
    const preset = presetFrom(
      [{ id: 'colorRamp-1', spec: 'colorRamp', position: { x: 0, y: 0 }, params: sourceParams }],
      [],
    );

    const { nodes } = remapForPaste(preset, new Set());
    const pastedParams = nodes[0]!.params;

    expect(pastedParams).toEqual(sourceParams);
    expect(pastedParams).not.toBe(sourceParams);
    expect(pastedParams.stops).not.toBe(sourceParams.stops);
    expect((pastedParams.stops as object[])[0]).not.toBe(sourceParams.stops[0]);
  });

  it('offsets every position by PASTE_OFFSET on both axes', () => {
    const preset = presetFrom(
      [
        { id: 'gradient-1', spec: 'gradient', position: { x: 10, y: 20 }, params: {} },
        { id: 'noise-1', spec: 'noise', position: { x: -5, y: 0 }, params: {} },
      ],
      [],
    );

    const { nodes } = remapForPaste(preset, new Set());

    expect(nodes.find((node) => node.spec === 'gradient')!.position).toEqual({
      x: 10 + PASTE_OFFSET,
      y: 20 + PASTE_OFFSET,
    });
    expect(nodes.find((node) => node.spec === 'noise')!.position).toEqual({
      x: -5 + PASTE_OFFSET,
      y: 0 + PASTE_OFFSET,
    });
  });

  it('produces disjoint id sets across two successive pastes of the same payload', () => {
    const preset = presetFrom(
      [{ id: 'gradient-1', spec: 'gradient', position: { x: 0, y: 0 }, params: {} }],
      [],
    );
    const takenIds = new Set<string>(['gradient-1']);

    const first = remapForPaste(preset, takenIds);

    for (const node of first.nodes) {
      takenIds.add(node.id);
    }
    const second = remapForPaste(preset, takenIds);

    const firstIds = new Set(first.nodes.map((node) => node.id));
    const secondIds = new Set(second.nodes.map((node) => node.id));

    for (const id of secondIds) {
      expect(firstIds.has(id)).toBe(false);
    }
  });
});

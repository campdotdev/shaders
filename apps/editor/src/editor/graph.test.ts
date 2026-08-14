import { describe, expect, it } from 'vitest';

import { rampStopsOf, structuralKeyOf } from './graph';
import type { GraphEdge, GraphNode } from './graph';
import { DEFAULT_RAMP_STOPS, defaultParamsOf } from './registry';

const ramp = (id: string, stops: number): GraphNode => ({
  id,
  spec: 'colorRamp',
  params: {
    stops: Array.from({ length: stops }, (_, i) => ({
      color: '#ffffff',
      position: i / (stops - 1),
    })),
  },
});
const edges: GraphEdge[] = [];

describe('structuralKeyOf', () => {
  it('ignores slider values', () => {
    const a: GraphNode = { id: 'n1', spec: 'noise', params: { scale: 3, speed: 0.15 } };
    const b: GraphNode = { id: 'n1', spec: 'noise', params: { scale: 9, speed: 0.9 } };

    expect(structuralKeyOf([a], edges)).toBe(structuralKeyOf([b], edges));
  });
  it('changes when a select changes', () => {
    const a: GraphNode = {
      id: 'n1',
      spec: 'blend',
      params: { ...defaultParamsOf('blend'), mode: 'mix' },
    };
    const b: GraphNode = {
      id: 'n1',
      spec: 'blend',
      params: { ...defaultParamsOf('blend'), mode: 'screen' },
    };

    expect(structuralKeyOf([a], edges)).not.toBe(structuralKeyOf([b], edges));
  });
  it('changes when ramp stop COUNT changes but not when stop values change', () => {
    const moved = ramp('r1', 3);

    (moved.params.stops as Array<{ position: number }>)[1]!.position = 0.9;
    expect(structuralKeyOf([ramp('r1', 3)], edges)).toBe(structuralKeyOf([moved], edges));
    expect(structuralKeyOf([ramp('r1', 3)], edges)).not.toBe(
      structuralKeyOf([ramp('r1', 4)], edges),
    );
  });
  it('changes when wiring changes', () => {
    const nodes = [ramp('r1', 3), { id: 'o1', spec: 'output', params: {} } as GraphNode];

    expect(structuralKeyOf(nodes, [{ source: 'r1', target: 'o1', targetHandle: 'in' }])).not.toBe(
      structuralKeyOf(nodes, []),
    );
  });
});

describe('rampStopsOf', () => {
  it('passes through an array param', () => {
    const node = ramp('r1', 2);

    expect(rampStopsOf(node)).toBe(node.params.stops);
  });
  it('falls back to the spec default when the param is missing, and deep-copies it', () => {
    const node: GraphNode = { id: 'r1', spec: 'colorRamp', params: {} };
    const stops = rampStopsOf(node);

    expect(stops).toEqual(DEFAULT_RAMP_STOPS);
    expect(stops).not.toBe(DEFAULT_RAMP_STOPS);
  });
  it('falls back when the param is not an array', () => {
    const node: GraphNode = { id: 'r1', spec: 'colorRamp', params: { stops: 'not-an-array' } };

    expect(rampStopsOf(node)).toEqual(DEFAULT_RAMP_STOPS);
  });
});

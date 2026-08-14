import { describe, expect, it } from 'vitest';

import { defaultParamsOf, NODE_SPECS, STAGE_COLORS } from './registry';
import type { NodeSpec, SpecId } from './registry';

const specs = Object.entries(NODE_SPECS) as Array<[SpecId, NodeSpec]>;

describe('stage signatures', () => {
  it('generate cards take no inputs and emit a field', () => {
    for (const [, spec] of specs.filter(([, s]) => s.stage === 'generate')) {
      expect(spec.inputs).toHaveLength(0);
      expect(spec.output).toBe('field');
    }
  });
  it('effect cards map field to field', () => {
    for (const [, spec] of specs.filter(([, s]) => s.stage === 'effect')) {
      expect(spec.inputs.every((input) => input.type === 'field')).toBe(true);
      expect(spec.output).toBe('field');
    }
  });
  it('color cards map field to color, adjust cards color to color', () => {
    for (const [, spec] of specs.filter(([, s]) => s.stage === 'color')) {
      expect(spec.inputs[0]?.type).toBe('field');
      expect(spec.output).toBe('color');
    }
    for (const [, spec] of specs.filter(([, s]) => s.stage === 'adjust')) {
      expect(spec.inputs[0]?.type).toBe('color');
      expect(spec.output).toBe('color');
    }
  });
});

describe('param specs', () => {
  it('every slider has min < max and a default inside the range', () => {
    for (const [, spec] of specs) {
      for (const param of spec.params) {
        if (param.kind !== 'slider') continue;
        expect(param.min).toBeLessThan(param.max);
        expect(param.defaultValue).toBeGreaterThanOrEqual(param.min);
        expect(param.defaultValue).toBeLessThanOrEqual(param.max);
      }
    }
  });
  it('ramp defaults are copied per instance, not shared', () => {
    const first = defaultParamsOf('colorRamp').stops;
    const second = defaultParamsOf('colorRamp').stops;

    expect(first).toEqual(second);
    expect(first).not.toBe(second);
  });
  it('every stage has a tint except output', () => {
    const stages = new Set(specs.map(([, spec]) => spec.stage));

    for (const stage of stages) {
      if (stage === 'output') continue;
      expect(STAGE_COLORS[stage]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

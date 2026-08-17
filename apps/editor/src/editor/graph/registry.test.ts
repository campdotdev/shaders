import { describe, expect, it } from 'vitest';

import { defaultParamsOf, NODE_SPECS, portsCompatible, STAGE_COLORS } from './registry';
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
  it('every xy param has min < max and both axis defaults inside the range', () => {
    for (const [, spec] of specs) {
      for (const param of spec.params) {
        if (param.kind !== 'xy') continue;
        expect(param.min).toBeLessThan(param.max);
        for (const axisDefault of param.defaultValue) {
          expect(axisDefault).toBeGreaterThanOrEqual(param.min);
          expect(axisDefault).toBeLessThanOrEqual(param.max);
        }
      }
    }
  });
  it('expands an xy param into its two number storage keys', () => {
    const params = defaultParamsOf('vignette');

    expect(params['center.x']).toBe(0.5);
    expect(params['center.y']).toBe(0.5);
    expect(params.center).toBeUndefined();
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

describe('portsCompatible', () => {
  it('allows a field wire into Output.in (the one exception)', () => {
    expect(portsCompatible('field', 'output', 'color')).toBe(true);
  });
  it('allows a color wire into Output.in (same-type, still fine)', () => {
    expect(portsCompatible('color', 'output', 'color')).toBe(true);
  });
  it('rejects a field wire into a color input on a non-output card', () => {
    expect(portsCompatible('field', 'tone', 'color')).toBe(false);
  });
  it('rejects a color wire into a field input (collapsing channels needs math)', () => {
    expect(portsCompatible('color', 'warp', 'field')).toBe(false);
  });
  it('allows a field wire into a field input (same-type sanity)', () => {
    expect(portsCompatible('field', 'warp', 'field')).toBe(true);
  });
});

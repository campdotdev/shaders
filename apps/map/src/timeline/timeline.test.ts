// Covers the pure scheduling math in timeline.ts: building a step schedule
// from durations, wrapping a clock position into range, and locating which
// step and progress a given position falls on.
import { describe, expect, it } from 'vitest';

import type { Flow } from '@/data/types';

import { buildSchedule, DEFAULT_STEP_SECONDS, locate, wrap } from './timeline';

function flowWithSteps(durations: Array<number | undefined>): Flow {
  return {
    id: 'f',
    title: 'F',
    payload: { name: 'p', description: '' },
    whatItDoes: [],
    howItsBuilt: [],
    steps: durations.map((duration, index) => ({
      from: `m${index}`,
      to: `m${index + 1}`,
      caption: '',
      files: [],
      ...(duration === undefined ? {} : { duration }),
    })),
  };
}

describe('buildSchedule', () => {
  it('starts each step where the previous one ends', () => {
    const schedule = buildSchedule(flowWithSteps([undefined, undefined, undefined]));

    expect(schedule.starts).toEqual([0, DEFAULT_STEP_SECONDS, DEFAULT_STEP_SECONDS * 2]);
    expect(schedule.total).toBe(DEFAULT_STEP_SECONDS * 3);
  });

  it('honors a per-step duration', () => {
    const schedule = buildSchedule(flowWithSteps([1, 3, undefined]));

    expect(schedule.starts).toEqual([0, 1, 4]);
    expect(schedule.durations).toEqual([1, 3, DEFAULT_STEP_SECONDS]);
    expect(schedule.total).toBe(4 + DEFAULT_STEP_SECONDS);
  });
});

describe('wrap', () => {
  it('keeps a position inside [0, total)', () => {
    expect(wrap(0, 4)).toBe(0);
    expect(wrap(4, 4)).toBe(0);
    expect(wrap(5, 4)).toBe(1);
    expect(wrap(-1, 4)).toBe(3);
  });

  it('returns 0 for an empty total', () => {
    expect(wrap(2, 0)).toBe(0);
  });
});

describe('locate', () => {
  const schedule = buildSchedule(flowWithSteps([1, 2, 1]));

  it('finds the first step at 0', () => {
    expect(locate(schedule, 0)).toEqual({ stepIndex: 0, progress: 0 });
  });

  it('finds a step at its exact start', () => {
    expect(locate(schedule, 1)).toEqual({ stepIndex: 1, progress: 0 });
  });

  it('reports progress through a step', () => {
    expect(locate(schedule, 2)).toEqual({ stepIndex: 1, progress: 0.5 });
  });

  it('wraps past the end', () => {
    expect(locate(schedule, 4)).toEqual({ stepIndex: 0, progress: 0 });
    expect(locate(schedule, 4.5)).toEqual({ stepIndex: 0, progress: 0.5 });
  });

  it('wraps before the start', () => {
    expect(locate(schedule, -0.5)).toEqual({ stepIndex: 2, progress: 0.5 });
  });
});

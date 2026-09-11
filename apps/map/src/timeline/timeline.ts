// The playback model as pure functions. A flow's steps lay out end to end on
// a clock; `locate` turns a position on that clock into a step and how far
// through it we are. No state lives here. store.ts owns the clock.
import type { Flow } from '@/data/types';

/** Seconds per hop when a step does not set its own duration. */
export const DEFAULT_STEP_SECONDS = 1.6;

export interface Schedule {
  /** Start time of each step, in seconds. */
  readonly starts: readonly number[];
  /** Duration of each step, in seconds. */
  readonly durations: readonly number[];
  /** End of the last step, in seconds. Playback wraps here. */
  readonly total: number;
}

export interface Location {
  readonly stepIndex: number;
  /** 0 at the step's start, 1 at its end. */
  readonly progress: number;
}

export function buildSchedule(flow: Flow): Schedule {
  const durations = flow.steps.map((step) => step.duration ?? DEFAULT_STEP_SECONDS);
  const starts: number[] = [];
  let elapsed = 0;

  for (const duration of durations) {
    starts.push(elapsed);
    elapsed += duration;
  }

  return { starts, durations, total: elapsed };
}

/** Folds any position into [0, total). Negative positions count back from the end. */
export function wrap(position: number, total: number): number {
  if (total <= 0) return 0;

  const remainder = position % total;

  return remainder < 0 ? remainder + total : remainder;
}

export function locate(schedule: Schedule, position: number): Location {
  const wrapped = wrap(position, schedule.total);
  let stepIndex = 0;

  // Walk back from the last step to the first: the current step is the last
  // one whose start we have passed.
  for (let index = schedule.starts.length - 1; index >= 0; index -= 1) {
    const start = schedule.starts[index];

    if (start !== undefined && wrapped >= start) {
      stepIndex = index;
      break;
    }
  }

  const start = schedule.starts[stepIndex] ?? 0;
  const duration = schedule.durations[stepIndex] ?? DEFAULT_STEP_SECONDS;

  return { stepIndex, progress: (wrapped - start) / duration };
}

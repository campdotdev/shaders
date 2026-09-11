// The playback clock and its operations, as an external store. Two readers
// with two speeds: the scene's frame loop reads `position` sixty times a
// second through getPosition() with no React involved, and the HTML around
// the scene subscribes to the snapshot, which only changes when the step
// index, the flow, the play state, or the speed changes. That split is what
// keeps a 60Hz clock from re-rendering the panel 60 times a second.
import { FLOWS, getFlow } from '@/data/flows';
import type { Flow } from '@/data/types';

import { buildSchedule, locate, type Schedule, wrap } from './timeline';

export type Speed = 0.5 | 1 | 2;
export const SPEEDS: readonly Speed[] = [0.5, 1, 2];

export interface PlaybackSnapshot {
  readonly flow: Flow;
  readonly playing: boolean;
  readonly speed: Speed;
  readonly stepIndex: number;
}

// ---- State -----------------------------------------------------------------

const initialFlow = FLOWS[0];

if (initialFlow === undefined) {
  throw new Error('The map needs at least one flow.');
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

const listeners = new Set<() => void>();
let schedule: Schedule = buildSchedule(initialFlow);
let position = 0;
let snapshot: PlaybackSnapshot = {
  flow: initialFlow,
  playing: !prefersReducedMotion(),
  speed: 1,
  stepIndex: 0,
};

function publish(patch: Partial<PlaybackSnapshot>): void {
  snapshot = { ...snapshot, ...patch };

  for (const listener of listeners) listener();
}

/** Re-derives the step index from the clock and publishes only if it moved. */
function syncStep(): void {
  const { stepIndex } = locate(schedule, position);

  if (stepIndex !== snapshot.stepIndex) publish({ stepIndex });
}

// ---- Reads -----------------------------------------------------------------

export function getPlaybackSnapshot(): PlaybackSnapshot {
  return snapshot;
}

export function subscribePlayback(listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

/** The clock, in seconds into the flow. Read from the frame loop, never from render. */
export function getPosition(): number {
  return position;
}

export function getSchedule(): Schedule {
  return schedule;
}

// ---- Operations -------------------------------------------------------------

// Arrow properties rather than methods so a button can take `playback.play`
// as its handler without the unbound-method lint rule objecting.
export const playback = {
  play: (): void => {
    publish({ playing: true });
  },
  pause: (): void => {
    publish({ playing: false });
  },
  toggle: (): void => {
    publish({ playing: !snapshot.playing });
  },
  setSpeed: (speed: Speed): void => {
    publish({ speed });
  },
  seek: (seconds: number): void => {
    position = wrap(seconds, schedule.total);
    syncStep();
  },
  seekToStep: (index: number): void => {
    const start = schedule.starts[index];

    if (start !== undefined) playback.seek(start);
  },
  /** Jumps to the next step's start and holds there. */
  stepForward: (): void => {
    const count = snapshot.flow.steps.length;

    publish({ playing: false });
    playback.seekToStep((snapshot.stepIndex + 1) % count);
  },
  /** Jumps to the previous step's start and holds there. */
  stepBack: (): void => {
    const count = snapshot.flow.steps.length;

    publish({ playing: false });
    playback.seekToStep((snapshot.stepIndex - 1 + count) % count);
  },
  selectFlow: (id: string): void => {
    const next = getFlow(id);

    if (next === undefined) return;

    schedule = buildSchedule(next);
    position = 0;
    publish({ flow: next, stepIndex: 0 });
  },
  /** Called once per frame with the frame's delta in seconds. */
  advance: (deltaSeconds: number): void => {
    if (!snapshot.playing) return;

    position = wrap(position + deltaSeconds * snapshot.speed, schedule.total);
    syncStep();
  },
};

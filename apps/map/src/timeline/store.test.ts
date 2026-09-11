import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FLOWS } from '@/data/flows';

import {
  getPlaybackSnapshot,
  getPosition,
  getSchedule,
  playback,
  subscribePlayback,
} from './store';

const flow = FLOWS[0]!;

describe('playback store', () => {
  beforeEach(() => {
    playback.selectFlow(flow.id);
    playback.pause();
    playback.setSpeed(1);
  });

  it('starts at the first step', () => {
    expect(getPlaybackSnapshot().stepIndex).toBe(0);
    expect(getPosition()).toBe(0);
  });

  it('does not advance while paused', () => {
    playback.advance(1);

    expect(getPosition()).toBe(0);
  });

  it('advances the clock while playing and publishes when the step changes', () => {
    const listener = vi.fn();
    const unsubscribe = subscribePlayback(listener);
    const firstDuration = getSchedule().durations[0]!;

    playback.play();
    listener.mockClear();
    playback.advance(firstDuration / 2);

    expect(listener).not.toHaveBeenCalled();
    expect(getPlaybackSnapshot().stepIndex).toBe(0);

    playback.advance(firstDuration / 2);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(getPlaybackSnapshot().stepIndex).toBe(1);

    unsubscribe();
  });

  it('scales the clock by speed', () => {
    const firstDuration = getSchedule().durations[0]!;

    playback.play();
    playback.setSpeed(2);
    playback.advance(firstDuration / 2);

    expect(getPlaybackSnapshot().stepIndex).toBe(1);
  });

  it('steps forward to the next step start and pauses', () => {
    playback.play();
    playback.stepForward();

    expect(getPlaybackSnapshot().playing).toBe(false);
    expect(getPlaybackSnapshot().stepIndex).toBe(1);
    expect(getPosition()).toBe(getSchedule().starts[1]);
  });

  it('wraps stepping forward past the last step', () => {
    playback.seekToStep(flow.steps.length - 1);
    playback.stepForward();

    expect(getPlaybackSnapshot().stepIndex).toBe(0);
  });

  it('wraps stepping back before the first step', () => {
    playback.stepBack();

    expect(getPlaybackSnapshot().stepIndex).toBe(flow.steps.length - 1);
  });

  it('loops the clock at the end of the flow', () => {
    playback.play();
    playback.advance(getSchedule().total + 0.1);

    expect(getPlaybackSnapshot().stepIndex).toBe(0);
    expect(getPosition()).toBeCloseTo(0.1);
  });
});

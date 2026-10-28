// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { type HeldStoryEvent, heldStoryReducer, type HeldStoryState, STILL } from './story-state';

const play = (...events: HeldStoryEvent[]): HeldStoryState =>
  events.reduce(heldStoryReducer, STILL);

const landed = (pointerOnCard = false, pushing = false): HeldStoryEvent => ({
  type: 'ending-landed',
  pointerOnCard,
  pushing,
});

describe('a held story', () => {
  it('holds from a hover, ends when the pointer leaves, and rests once the ending lands', () => {
    expect(play({ type: 'pointer-enter' })).toEqual({
      stage: 'holding',
      plays: 1,
      heldBy: 'pointer',
    });
    expect(play({ type: 'pointer-enter' }, { type: 'pointer-leave' })).toMatchObject({
      stage: 'ending',
    });
    expect(play({ type: 'pointer-enter' }, { type: 'pointer-leave' }, landed())).toMatchObject({
      stage: 'still',
      plays: 1,
    });
  });

  it('lets the ending land before a hover during it starts a fresh hold', () => {
    const ending = play(
      { type: 'pointer-enter' },
      { type: 'pointer-leave' },
      { type: 'pointer-enter' },
    );

    expect(ending).toMatchObject({ stage: 'ending', plays: 1 });
    expect(heldStoryReducer(ending, landed(true))).toEqual({
      stage: 'holding',
      plays: 2,
      heldBy: 'pointer',
    });
  });

  it('holds from a scroll push, which only the push ending ends', () => {
    const pushed = play({ type: 'push-start' });

    expect(pushed).toEqual({ stage: 'holding', plays: 1, heldBy: 'push' });
    expect(heldStoryReducer(pushed, { type: 'pointer-leave' })).toBe(pushed);
    expect(heldStoryReducer(pushed, { type: 'push-end' })).toMatchObject({ stage: 'ending' });
  });

  it('keeps a hover hold when a push starts or ends', () => {
    const hovered = play({ type: 'pointer-enter' });

    expect(heldStoryReducer(hovered, { type: 'push-start' })).toBe(hovered);
    expect(heldStoryReducer(hovered, { type: 'push-end' })).toBe(hovered);
  });

  it('starts a fresh push hold when a push is still going as the ending lands', () => {
    const ending = play({ type: 'push-start' }, { type: 'push-end' }, { type: 'push-start' });

    expect(ending).toMatchObject({ stage: 'ending', plays: 1 });
    expect(heldStoryReducer(ending, landed(false, true))).toEqual({
      stage: 'holding',
      plays: 2,
      heldBy: 'push',
    });
  });
});

/**
 * Where a feature card's held story is, and how each event moves it
 * (story.tsx). A pure reducer, so the rules are testable without a DOM.
 */

/**
 * Where a held story is. It rests on the still frame, holds while the
 * pointer stays or a scroll push runs, and plays its ending back to the
 * still frame once the hold ends.
 */
export type HeldStage = 'still' | 'holding' | 'ending';

/**
 * What holds the story: a hovering pointer, or a touch that scrolls the
 * page over the card, a scroll push, from its first push to its fling's
 * end.
 */
export type HeldBy = 'pointer' | 'push';

export interface HeldStoryState {
  stage: HeldStage;
  /**
   * Counts the story's plays. An illustration keys its animation by it, so
   * every play starts from the still frame.
   */
  plays: number;
  /** What holds the current play, or held the last one. */
  heldBy: HeldBy;
}

export type HeldStoryEvent =
  | { type: 'pointer-enter' }
  | { type: 'pointer-leave' }
  | { type: 'push-start' }
  | { type: 'push-end' }
  /** The ending landed on the still frame, with what is on the card now. */
  | { type: 'ending-landed'; pointerOnCard: boolean; pushing: boolean };

export const STILL: HeldStoryState = { stage: 'still', plays: 0, heldBy: 'pointer' };

const hold = (state: HeldStoryState, heldBy: HeldBy): HeldStoryState => ({
  stage: 'holding',
  plays: state.plays + 1,
  heldBy,
});

// What each start and end event is about.
const STARTED_BY = { 'pointer-enter': 'pointer', 'push-start': 'push' } as const;
const ENDED_BY = { 'pointer-leave': 'pointer', 'push-end': 'push' } as const;

// An ending that lands with the pointer still on the card, or a push still
// running, starts a fresh hold, the pointer's first.
function land(state: HeldStoryState, pointerOnCard: boolean, pushing: boolean): HeldStoryState {
  if (pointerOnCard) return hold(state, 'pointer');
  if (pushing) return hold(state, 'push');

  return { ...state, stage: 'still' };
}

/**
 * Only the still frame starts a hold, so an event during a hold or an
 * ending waits. Only what started a hold ends it, and only a landing ends
 * an ending.
 */
export function heldStoryReducer(state: HeldStoryState, event: HeldStoryEvent): HeldStoryState {
  if (event.type === 'ending-landed') {
    return state.stage === 'ending' ? land(state, event.pointerOnCard, event.pushing) : state;
  }
  if (event.type === 'pointer-enter' || event.type === 'push-start') {
    return state.stage === 'still' ? hold(state, STARTED_BY[event.type]) : state;
  }

  return state.stage === 'holding' && state.heldBy === ENDED_BY[event.type]
    ? { ...state, stage: 'ending' }
    : state;
}

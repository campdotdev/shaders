'use client';

/**
 * The lifecycle every feature card's story shares (SHA-178): a hover plays
 * the story, and a story under way always finishes after the pointer leaves.
 * Touch, keyboard, and reduced motion leave the card on its still frame.
 * StoryCard is the card. An illustration takes one of two story shapes:
 * useStory repeats a play while the pointer stays, and useHeldStory opens,
 * holds while the pointer stays, then ends.
 */
import {
  createContext,
  type ReactNode,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import { useReducedMotion } from 'motion/react';

import { useCanHover } from '@/lib/use-can-hover';

// ---------------------------------------------
// The card
// ---------------------------------------------

// The card's element, which an illustration's story listens to for the
// pointer. Null outside a StoryCard.
const CardContext = createContext<RefObject<HTMLLIElement | null> | null>(null);

/**
 * A feature card: its list item, which hovering plays the story of the
 * illustration inside it. A card whose illustration has no story yet does
 * nothing on hover, because nothing inside it listens.
 */
export function StoryCard({ className, children }: { className?: string; children: ReactNode }) {
  const cardRef = useRef<HTMLLIElement>(null);

  return (
    <li className={className} ref={cardRef}>
      <CardContext value={cardRef}>{children}</CardContext>
    </li>
  );
}

// ---------------------------------------------
// The pointer
// ---------------------------------------------

/**
 * Follows the pointer on the illustration's StoryCard, behind the site's
 * hover gate, and calls `onEnter` and any `onLeave` as it comes and goes. Only a
 * pointer that passes the gate counts, and a touch never does, even on a
 * touch-screen laptop that passes the gate. Under reduced motion nothing
 * counts. Returns whether the pointer is on the card now, which only the
 * ends of a story's parts read, so it lives in a ref rather than in state.
 */
function useCardPointer(onEnter: () => void, onLeave?: () => void): RefObject<boolean> {
  const cardRef = useContext(CardContext);
  const canHover = useCanHover();
  const reducedMotion = useReducedMotion() === true;
  const pointerOnCardRef = useRef(false);
  // The latest callbacks, so the listeners below call the current ones
  // without being added again on every render.
  const callbacksRef = useRef({ onEnter, onLeave });

  useEffect(() => {
    callbacksRef.current = { onEnter, onLeave };
  });

  // Listens to the card itself, so the whole card is the hover target, not
  // just the illustration.
  useEffect(() => {
    const card = cardRef?.current;

    if (!card || !canHover || reducedMotion) return undefined;

    const onPointerEnter = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      pointerOnCardRef.current = true;
      callbacksRef.current.onEnter();
    };
    const onPointerLeave = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      pointerOnCardRef.current = false;
      callbacksRef.current.onLeave?.();
    };

    card.addEventListener('pointerenter', onPointerEnter);
    card.addEventListener('pointerleave', onPointerLeave);

    // The gate closing counts as the pointer leaving, so a held story ends
    // rather than holding with no pointer to release it.
    return () => {
      card.removeEventListener('pointerenter', onPointerEnter);
      card.removeEventListener('pointerleave', onPointerLeave);

      if (pointerOnCardRef.current) {
        pointerOnCardRef.current = false;
        callbacksRef.current.onLeave?.();
      }
    };
  }, [cardRef, canHover, reducedMotion]);

  return pointerOnCardRef;
}

// ---------------------------------------------
// A story that repeats
// ---------------------------------------------

/** Where an illustration's story is: playing or not, which play, and how to end one. */
export interface Story {
  /** True from the hover that starts the story until a play ends with the pointer off the card. */
  playing: boolean;
  /**
   * Counts the story's plays: one more each time a play starts, including a
   * play that follows another because the pointer stayed. An illustration
   * keys its animation by it, so every play starts from the still frame.
   */
  plays: number;
  /** Called by the illustration each time a play lands back on the still frame. */
  onStoryEnd: () => void;
}

/**
 * The story of the illustration that calls it, played by a hover on its
 * StoryCard. A play that ends with the pointer still on the card starts the
 * next one, so the story keeps going while the pointer stays.
 */
export function useStory(): Story {
  const [story, setStory] = useState({ playing: false, plays: 0 });
  const pointerOnCardRef = useCardPointer(
    // A play under way carries on, so a hover during it doesn't restart it.
    () =>
      setStory((current) =>
        current.playing ? current : { playing: true, plays: current.plays + 1 },
      ),
  );

  // A play that ends with the pointer still on the card starts the next one.
  // Otherwise the card rests on its still frame.
  const onStoryEnd = () => {
    const keepGoing = pointerOnCardRef.current;

    setStory((current) =>
      keepGoing ? { playing: true, plays: current.plays + 1 } : { ...current, playing: false },
    );
  };

  return { ...story, onStoryEnd };
}

// ---------------------------------------------
// A story that holds
// ---------------------------------------------

/**
 * Where a held story is. It rests on the still frame, plays its opening on a
 * hover, holds while the pointer stays, and plays its ending back to the
 * still frame once the pointer leaves.
 */
export type HeldStage = 'still' | 'opening' | 'holding' | 'ending';

/** Where an illustration's held story is, which play, and how to end each part. */
export interface HeldStory {
  stage: HeldStage;
  /**
   * Counts the story's openings. An illustration keys its animation by it,
   * so every play starts from the still frame.
   */
  plays: number;
  /** Called by the illustration when its opening lands on the hold. */
  onOpeningEnd: () => void;
  /** Called by the illustration when its ending lands on the still frame. */
  onStoryEnd: () => void;
}

/**
 * The held story of the illustration that calls it, played by a hover on
 * its StoryCard. Each part runs to its end once it starts. A pointer that
 * leaves during the opening lets it land, then the ending plays with no
 * hold. A pointer that comes back during the ending lets it land on the
 * still frame, then a fresh opening plays.
 */
export function useHeldStory(): HeldStory {
  const [story, setStory] = useState<{ stage: HeldStage; plays: number }>({
    stage: 'still',
    plays: 0,
  });
  const pointerOnCardRef = useCardPointer(
    // Only the still frame opens the story. A hover during the opening or
    // the ending waits for that part to land.
    () =>
      setStory((current) =>
        current.stage === 'still' ? { stage: 'opening', plays: current.plays + 1 } : current,
      ),
    // Leaving during the hold ends the story. Leaving during the opening
    // waits for it to land.
    () =>
      setStory((current) =>
        current.stage === 'holding' ? { ...current, stage: 'ending' } : current,
      ),
  );

  // Stable, so an illustration can list them in an effect's deps without
  // restarting the part under way on every render.
  const onOpeningEnd = useCallback(() => {
    const holding = pointerOnCardRef.current;

    setStory((current) =>
      current.stage === 'opening' ? { ...current, stage: holding ? 'holding' : 'ending' } : current,
    );
  }, [pointerOnCardRef]);

  const onStoryEnd = useCallback(() => {
    const reopening = pointerOnCardRef.current;

    setStory((current) => {
      if (current.stage !== 'ending') return current;

      return reopening
        ? { stage: 'opening', plays: current.plays + 1 }
        : { ...current, stage: 'still' };
    });
  }, [pointerOnCardRef]);

  return { ...story, onOpeningEnd, onStoryEnd };
}

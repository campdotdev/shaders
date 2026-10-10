'use client';

/**
 * The lifecycle every feature card's story shares (SHA-178): a hover plays
 * the story, which keeps going while the pointer stays and finishes the play
 * under way once it leaves. Touch, keyboard, and reduced motion leave the card
 * on its still frame. StoryCard is the card, and useStory the illustration's side.
 */
import {
  createContext,
  type ReactNode,
  type RefObject,
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
// The story
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
 * StoryCard. Only a pointer that passes the site's hover gate starts it,
 * and a touch never does, even on a touch-screen laptop that passes the
 * gate. Under reduced motion nothing starts it.
 */
export function useStory(): Story {
  const cardRef = useContext(CardContext);
  const canHover = useCanHover();
  const reducedMotion = useReducedMotion() === true;
  const [story, setStory] = useState({ playing: false, plays: 0 });
  // Whether the pointer is on the card. Only the end of a play reads it, so
  // it lives in a ref rather than in state.
  const pointerOnCardRef = useRef(false);

  // Listens to the card itself, so the whole card is the hover target, not
  // just the illustration.
  useEffect(() => {
    const card = cardRef?.current;

    if (!card || !canHover || reducedMotion) return undefined;

    const onPointerEnter = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      pointerOnCardRef.current = true;
      // A play under way carries on, so a hover during it doesn't restart it.
      setStory((current) =>
        current.playing ? current : { playing: true, plays: current.plays + 1 },
      );
    };
    const onPointerLeave = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') pointerOnCardRef.current = false;
    };

    card.addEventListener('pointerenter', onPointerEnter);
    card.addEventListener('pointerleave', onPointerLeave);

    return () => {
      pointerOnCardRef.current = false;
      card.removeEventListener('pointerenter', onPointerEnter);
      card.removeEventListener('pointerleave', onPointerLeave);
    };
  }, [cardRef, canHover, reducedMotion]);

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

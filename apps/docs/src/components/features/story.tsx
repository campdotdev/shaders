'use client';

/**
 * The lifecycle every feature card's story shares (SHA-178): a hover plays
 * the story, and a story under way always finishes after the pointer leaves.
 * Keyboard and reduced motion leave the card on its still frame, and so does
 * touch, unless the illustration passes a scroll push to a held story.
 * StoryCard is the card. An illustration takes one of two story shapes:
 * useStory repeats a play while the pointer stays, and useHeldStory holds
 * while the pointer stays, then plays its ending. A held story can follow
 * the pointer, and can wait for its live scene.
 */
import {
  type ComponentType,
  createContext,
  type ReactNode,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
  useState,
} from 'react';

import { useReducedMotion } from 'motion/react';

import { usePauseHeroWhile } from '@/components/home-hero/hero-pause';
import { useCanHover } from '@/lib/use-can-hover';
import { useHasWebGpu } from '@/lib/use-has-webgpu';

import { type HeldBy, type HeldStage, heldStoryReducer, STILL } from './story-state';

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
 * hover gate, and calls `onEnter` and any `onLeave` as it comes and goes,
 * and any `onMove` with each move over the card, starting with the move
 * the pointer enters on. Only a pointer that passes the gate counts, and a
 * touch never does, even on a touch-screen laptop that passes the gate.
 * Under reduced motion, or while `enabled` is false, nothing counts.
 * Returns whether the pointer is on the card now, which only the ends of a
 * story's parts read, so it lives in a ref rather than in state.
 */
function useCardPointer(
  onEnter: () => void,
  onLeave?: () => void,
  { enabled = true, onMove }: { enabled?: boolean; onMove?: (event: PointerEvent) => void } = {},
): RefObject<boolean> {
  const cardRef = useContext(CardContext);
  const canHover = useCanHover();
  const reducedMotion = useReducedMotion() === true;
  const pointerOnCardRef = useRef(false);
  // The latest callbacks, so the listeners below call the current ones
  // without being added again on every render.
  const callbacksRef = useRef({ onEnter, onLeave, onMove });

  useEffect(() => {
    callbacksRef.current = { onEnter, onLeave, onMove };
  });

  // Listens to the card itself, so the whole card is the hover target, not
  // just the illustration.
  useEffect(() => {
    const card = cardRef?.current;

    if (!card || !canHover || reducedMotion || !enabled) return undefined;

    const onPointerEnter = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      pointerOnCardRef.current = true;
      callbacksRef.current.onMove?.(event);
      callbacksRef.current.onEnter();
    };
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      callbacksRef.current.onMove?.(event);
    };
    const onPointerLeave = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      pointerOnCardRef.current = false;
      callbacksRef.current.onLeave?.();
    };

    card.addEventListener('pointerenter', onPointerEnter);
    card.addEventListener('pointermove', onPointerMove);
    card.addEventListener('pointerleave', onPointerLeave);

    // A pointer already on the card as the gate opens sends no
    // pointerenter, so it counts as entering now. Its first move tells
    // `onMove` where it is.
    if (card.matches(':hover')) {
      pointerOnCardRef.current = true;
      callbacksRef.current.onEnter();
    }

    // The gate closing counts as the pointer leaving, so a held story ends
    // rather than holding with no pointer to release it.
    return () => {
      card.removeEventListener('pointerenter', onPointerEnter);
      card.removeEventListener('pointermove', onPointerMove);
      card.removeEventListener('pointerleave', onPointerLeave);

      if (pointerOnCardRef.current) {
        pointerOnCardRef.current = false;
        callbacksRef.current.onLeave?.();
      }
    };
  }, [cardRef, canHover, reducedMotion, enabled]);

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

export type { HeldBy, HeldStage } from './story-state';

/** Where an illustration's held story is, which play, and how to end it. */
export interface HeldStory {
  stage: HeldStage;
  /**
   * Counts the story's plays. An illustration keys its animation by it, so
   * every play starts from the still frame.
   */
  plays: number;
  /** What holds the current play, or held the last one. */
  heldBy: HeldBy;
  /** Called by the illustration when its ending lands on the still frame. */
  onStoryEnd: () => void;
  /**
   * For an illustration whose scene has scroll push on: holds the story
   * from the touch's first push, as a hover does, and ends it once the
   * fling settles. Stable. Under reduced motion, or while the story isn't
   * enabled, a push holds nothing.
   */
  onPushStart: () => void;
  onPushEnd: () => void;
}

/** How an illustration with a held story takes part in it. */
interface HeldStoryOptions {
  /**
   * False keeps the card on its still frame, ignoring the pointer and any
   * push, as a card does until its live scene shows the still frame.
   * Defaults to true.
   */
  enabled?: boolean;
  /**
   * Called with each pointer move over the card, starting with the move the
   * pointer enters on, for a story that follows the pointer.
   */
  onPointerMove?: (event: PointerEvent) => void;
  /**
   * Pauses the homepage hero while the story plays and the card is in view,
   * for a story with a live scene, as a playing favorite does. Off screen
   * the card's scene pauses, so the hero can draw. Defaults to false.
   */
  pausesHero?: boolean;
}

/** Whether the illustration's StoryCard is on screen, which only a live story's hero pause reads. */
function useCardInView(watching: boolean): boolean {
  const cardRef = useContext(CardContext);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const card = cardRef?.current;

    if (!watching || !card) return undefined;
    const observer = new IntersectionObserver(([entry]) =>
      setInView(entry?.isIntersecting ?? false),
    );

    observer.observe(card);

    return () => observer.disconnect();
  }, [cardRef, watching]);

  return watching && inView;
}

/**
 * The held story of the illustration that calls it, played by a hover on
 * its StoryCard or by a scroll push the illustration passes on. Its ending
 * runs to the still frame once it starts. A pointer or a push that comes
 * back during the ending lets it land, then a fresh play starts
 * (story-state.ts has the rules).
 */
export function useHeldStory({
  enabled = true,
  onPointerMove,
  pausesHero = false,
}: HeldStoryOptions = {}): HeldStory {
  const [story, dispatch] = useReducer(heldStoryReducer, STILL);
  const reducedMotion = useReducedMotion() === true;
  // Whether a push runs now, which only the ending's landing reads.
  const pushingRef = useRef(false);
  const pointerOnCardRef = useCardPointer(
    () => dispatch({ type: 'pointer-enter' }),
    () => dispatch({ type: 'pointer-leave' }),
    { enabled, onMove: onPointerMove },
  );
  const canPush = enabled && !reducedMotion;

  const onPushStart = useCallback(() => {
    if (!canPush) return;
    pushingRef.current = true;
    dispatch({ type: 'push-start' });
  }, [canPush]);

  const onPushEnd = useCallback(() => {
    pushingRef.current = false;
    dispatch({ type: 'push-end' });
  }, []);

  // Pushes stopping counts as the push ending, as the hover gate closing
  // counts as the pointer leaving, so a push hold never outlives them.
  useEffect(
    () => () => {
      if (!pushingRef.current) return;
      pushingRef.current = false;
      dispatch({ type: 'push-end' });
    },
    [canPush],
  );

  usePauseHeroWhile(useCardInView(pausesHero) && story.stage !== 'still');

  // Stable, so an illustration can list it in an effect's deps without
  // restarting the play under way on every render.
  const onStoryEnd = useCallback(() => {
    dispatch({
      type: 'ending-landed',
      pointerOnCard: pointerOnCardRef.current,
      pushing: pushingRef.current,
    });
  }, [pointerOnCardRef]);

  return { ...story, onStoryEnd, onPushStart, onPushEnd };
}

// ---------------------------------------------
// A live scene
// ---------------------------------------------

/**
 * A live scene for an illustration's story: `load` imports its module. The
 * returned hook gives the scene's component where the scene may run, a
 * browser with a WebGPU adapter and motion allowed, once its module has
 * loaded, and null until then and anywhere else, where the card shows its
 * still frame as an image. The module loads as the card mounts, so the
 * scene mounts before the card scrolls into view. It loads through a plain
 * import() from an effect rather than next/dynamic, for the reason
 * favorite-scenes.tsx gives, which also keeps three out of the server
 * render.
 */
export function createLiveScene<Props extends object>(
  load: () => Promise<{ default: ComponentType<Props> }>,
): () => ComponentType<Props> | null {
  // The component once its module has loaded, so a later mount reads it
  // straight away.
  let loaded: ComponentType<Props> | null = null;

  return function useLiveScene() {
    const hasWebGpu = useHasWebGpu();
    const reducedMotion = useReducedMotion() === true;
    const enabled = hasWebGpu && !reducedMotion;
    const [scene, setScene] = useState(() => loaded);

    useEffect(() => {
      if (!enabled || scene) return undefined;

      let cancelled = false;

      load()
        .then((module) => {
          loaded = module.default;
          if (!cancelled) setScene(() => module.default);
        })
        .catch(() => {
          // A module that fails to load leaves the card on its image.
        });

      return () => {
        cancelled = true;
      };
    }, [enabled, scene]);

    return enabled ? scene : null;
  };
}

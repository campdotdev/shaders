'use client';

/**
 * The Reactive feature card's illustration (SHA-216): the mock's pointer
 * arrow over a live LiquidGradient with a smudge held along the J path
 * (reactive-scene.tsx), where the browser has WebGPU. Anywhere else, and
 * until the scene has laid the smudge, the card shows the image exported
 * from the mock. A hover sends the arrow off the window and back in to the
 * visitor's pointer, which it then follows, pointing the way the pointer
 * moves, while the pointer smudges the gradient (story.tsx's held story).
 */
import Image from 'next/image';
import {
  type ComponentType,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  animate,
  domMin,
  LazyMotion,
  m,
  type MotionStyle,
  type MotionValue,
  useMotionValue,
  useSpring,
  useTransform,
} from 'motion/react';

import { usePauseHeroWhile } from '@/components/home-hero/hero-pause';
import { EASE_OUT } from '@/lib/easing';
import { useHasWebGpu } from '@/lib/use-has-webgpu';

import {
  angleForHeading,
  arrowAtPointer,
  type ArrowPose,
  arrowTip,
  entryPoint,
  headingToward,
  MOCK_HEIGHT,
  MOCK_WIDTH,
  pointAlong,
  STILL_FRAME_ARROW,
  STILL_FRAME_HEADING,
  STILL_FRAME_TIP,
} from './reactive-arrow';
import styles from './reactive-illustration.module.css';
import type { ReactiveSceneProps } from './reactive-scene';
import { type HeldStage, useHeldStory } from './story';

// ---------------------------------------------
// Loading the scene
// ---------------------------------------------

type Scene = ComponentType<ReactiveSceneProps>;

// The scene's component once its module has loaded, so a later mount reads
// it straight away. The module loads through a plain import() from an
// effect rather than next/dynamic, for the reason favorite-scenes.tsx gives,
// which also keeps three out of the server render.
let loadedScene: Scene | null = null;

function loadScene(): Promise<Scene> {
  return import('./reactive-scene').then((module) => {
    loadedScene = module.default;

    return module.default;
  });
}

/** The scene's component once `enabled` and its module has loaded, otherwise null. */
function useReactiveScene(enabled: boolean): Scene | null {
  const [scene, setScene] = useState(() => loadedScene);

  useEffect(() => {
    if (!enabled || scene) return undefined;

    let cancelled = false;

    loadScene()
      .then((loaded) => {
        if (!cancelled) setScene(() => loaded);
      })
      .catch(() => {
        // A module that fails to load leaves the card on its image.
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, scene]);

  return enabled ? scene : null;
}

// ---------------------------------------------
// The arrow
// ---------------------------------------------

// The mock's arrow: its body, and the light halo around it, which an
// overlay blend tints with whatever lies under it. Two elements side by
// side rather than one group, because a transform on a shared parent would
// cut the halo's blend off from the canvas beneath. Both read their pose
// from the CSS variables the illustration sets.
function Arrow() {
  return (
    <>
      <Image
        alt=""
        className={styles.pointer}
        data-part="halo"
        height={88}
        src="/features/reactive-pointer-halo.svg"
        width={72}
      />
      <Image
        alt=""
        className={styles.pointer}
        data-part="body"
        height={88}
        src="/features/reactive-pointer.svg"
        width={72}
      />
    </>
  );
}

// ---------------------------------------------
// The story
// ---------------------------------------------

// The pose's CSS variables, which reactive-illustration.module.css reads.
type ArrowStyle = MotionStyle & {
  '--arrow-x': MotionValue<number>;
  '--arrow-y': MotionValue<number>;
  '--arrow-angle': MotionValue<number>;
};

// How long each leg of the handoff takes, in seconds: the arrow flicks off
// the window along its heading, then flies back in to the pointer.
const OUT_SECONDS = 0.25;
const IN_SECONDS = 0.35;

// How far the arrow flies out along its heading, in mock pixels: past the
// window's edge from the still frame's spot.
const OUT_DISTANCE = 260;

// How far the pointer travels, in mock pixels, before the arrow takes its
// heading from the move. A shorter move is a tremble, not a direction.
const HEADING_STEP = 4;

// How the arrow turns to a new heading: a spring that settles in about
// 0.2 s, with no bounce.
const TURN_SPRING = { visualDuration: 0.2, bounce: 0 };

// CursorSmudge's decay while the story plays: a pull loses 90% in about
// 1.2 s, so the J ages out and each stroke eases back behind the cursor.
const STORY_DECAY = 0.4;

/** The pointer over the card, in mock pixels, and the way it heads. */
interface CardPointer {
  x: MotionValue<number>;
  y: MotionValue<number>;
  /** In degrees with y down, unwrapped, so following it always turns the short way. */
  heading: MotionValue<number>;
  /** Where the pointer was when the hover started, or null before it has. */
  enteredAt: RefObject<[number, number] | null>;
}

/**
 * Tracks the pointer over the card from its moves. The heading follows the
 * pointer once a move adds up to HEADING_STEP, so a still or trembling
 * pointer keeps its heading.
 */
function useCardPointer(illustrationRef: RefObject<HTMLDivElement | null>) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const heading = useMotionValue(STILL_FRAME_HEADING);
  const enteredAt = useRef<[number, number] | null>(null);
  // Where the move that sets the next heading started, or null before the
  // first move of a hover.
  const moveStartRef = useRef<[number, number] | null>(null);

  const onPointerMove = (event: PointerEvent) => {
    const rect = illustrationRef.current?.getBoundingClientRect();

    if (!rect || rect.width === 0 || rect.height === 0) return;
    const nextX = ((event.clientX - rect.left) / rect.width) * MOCK_WIDTH;
    const nextY = ((event.clientY - rect.top) / rect.height) * MOCK_HEIGHT;
    const moveStart = moveStartRef.current;

    x.set(nextX);
    y.set(nextY);
    if (!moveStart) {
      enteredAt.current = [nextX, nextY];
      moveStartRef.current = [nextX, nextY];

      return;
    }
    const dx = nextX - moveStart[0];
    const dy = nextY - moveStart[1];

    if (Math.hypot(dx, dy) < HEADING_STEP) return;
    heading.set(headingToward(heading.get(), dx, dy));
    moveStartRef.current = [nextX, nextY];
  };

  // Ready for the next hover. Stable, so the story's ending can list it in
  // an effect's deps.
  const reset = useCallback(() => {
    enteredAt.current = null;
    moveStartRef.current = null;
    heading.jump(STILL_FRAME_HEADING);
  }, [heading]);

  return { pointer: { x, y, heading, enteredAt } satisfies CardPointer, onPointerMove, reset };
}

/** Where the arrow is in a hover: resting, flying out, flying back in, or following the pointer. */
type Leg = 'resting' | 'out' | 'in' | 'following';

// The tip of `pose`, in 0..1 canvas units, for a scripted stroke.
const canvasTip = (pose: ArrowPose): [number, number] => {
  const [x, y] = arrowTip(pose);

  return [x / MOCK_WIDTH, y / MOCK_HEIGHT];
};

/**
 * The arrow's part in the held story. It rests in the still frame's pose.
 * When a hover starts, it flicks off the window along its heading, then
 * flies back in from past the edge nearest where the pointer came in, to
 * the pointer, and from then on follows the pointer 1:1, turning to point
 * the way the pointer moves. On both flights its tip lays a scripted
 * stroke. Returns the leg, the pose's CSS variables, and the tip while it
 * strokes.
 *
 * Phase 2 has no ending yet: leaving the card snaps the arrow back to its
 * spot and ends the story at once.
 */
function useArrow(
  stage: HeldStage,
  plays: number,
  onStoryEnd: () => void,
  pointer: CardPointer,
  resetPointer: () => void,
) {
  // The last leg each play finished. Each play flies out, then back in,
  // then follows the pointer.
  const [finished, setFinished] = useState<{ play: number; leg: 'out' | 'in' } | null>(null);
  let leg: Leg = 'following';

  if (stage !== 'holding') leg = 'resting';
  else if (finished?.play !== plays) leg = 'out';
  else if (finished.leg === 'out') leg = 'in';

  const out = useMotionValue(0);
  const flightIn = useMotionValue(0);
  const entryX = useMotionValue(0);
  const entryY = useMotionValue(0);
  const turn = useSpring(pointer.heading, TURN_SPRING);

  const outPose = useTransform(out, (progress) =>
    arrowAtPointer(
      pointAlong(STILL_FRAME_TIP, STILL_FRAME_HEADING, progress * OUT_DISTANCE),
      STILL_FRAME_ARROW.angle,
    ),
  );
  const inPose = useTransform(() => {
    const progress = flightIn.get();
    const fromX = entryX.get();
    const fromY = entryY.get();

    return arrowAtPointer(
      [fromX + (pointer.x.get() - fromX) * progress, fromY + (pointer.y.get() - fromY) * progress],
      angleForHeading(turn.get()),
    );
  });
  // A computed motion value collects what it reads on each render, so this
  // follows only the leg the arrow is on.
  const pose = useTransform((): ArrowPose => {
    if (leg === 'out') return outPose.get();
    if (leg === 'in') return inPose.get();
    if (leg === 'following') {
      return arrowAtPointer([pointer.x.get(), pointer.y.get()], angleForHeading(turn.get()));
    }

    return STILL_FRAME_ARROW;
  });
  const arrowX = useTransform(pose, ({ x }) => x);
  const arrowY = useTransform(pose, ({ y }) => y);
  const arrowAngle = useTransform(pose, ({ angle }) => angle);
  // Two tips, one per flight, so the scene starts a fresh stroke at the
  // edge rather than drawing one from where the flight out left the window.
  const outTip = useTransform(outPose, canvasTip);
  const inTip = useTransform(inPose, canvasTip);

  // The scene attaches a flight's tip as a scripted stroke in an effect of
  // its own, in the render where the leg starts, reading where the tip is
  // as the stroke's start. A child's effects run before its parent's, so
  // the flights below never run ahead of the attach, and the flight in is
  // set up before its leg starts.
  useEffect(() => {
    if (leg !== 'out') return undefined;
    const controls = animate(out, 1, { duration: OUT_SECONDS, ease: EASE_OUT });

    void controls.then(() => {
      const [fromX, fromY] = entryPoint(
        pointer.enteredAt.current ?? [pointer.x.get(), pointer.y.get()],
      );
      const heading = headingToward(
        STILL_FRAME_HEADING,
        pointer.x.get() - fromX,
        pointer.y.get() - fromY,
      );

      entryX.jump(fromX);
      entryY.jump(fromY);
      flightIn.jump(0);
      pointer.heading.jump(heading);
      turn.jump(heading);
      setFinished({ play: plays, leg: 'out' });
    });

    return () => controls.stop();
  }, [leg, plays, out, flightIn, entryX, entryY, pointer, turn]);

  useEffect(() => {
    if (leg !== 'in') return undefined;
    const controls = animate(flightIn, 1, { duration: IN_SECONDS, ease: EASE_OUT });

    void controls.then(() => setFinished({ play: plays, leg: 'in' }));

    return () => controls.stop();
  }, [leg, plays, flightIn]);

  useEffect(() => {
    if (stage !== 'ending') return;
    out.jump(0);
    flightIn.jump(0);
    resetPointer();
    turn.jump(STILL_FRAME_HEADING);
    onStoryEnd();
  }, [stage, out, flightIn, resetPointer, turn, onStoryEnd]);

  const style: ArrowStyle = {
    '--arrow-x': arrowX,
    '--arrow-y': arrowY,
    '--arrow-angle': arrowAngle,
  };
  let strokeAt: MotionValue<[number, number]> | null = null;

  if (leg === 'out') strokeAt = outTip;
  else if (leg === 'in') strokeAt = inTip;

  return { leg, style, strokeAt };
}

// ---------------------------------------------
// The illustration
// ---------------------------------------------

// Hidden from screen readers: the card's title and description carry its
// message. `data-scene` says whether the live scene shows the still frame
// yet, `data-stage` where the story is, and `data-arrow` where the arrow is
// in it.
//
// `m` under LazyMotion rather than `motion`, as in the other feature cards:
// the illustration only binds motion values to style, which domMin covers.
export function ReactiveIllustration() {
  const Scene = useReactiveScene(useHasWebGpu());
  const [laid, setLaid] = useState(false);
  const illustrationRef = useRef<HTMLDivElement>(null);
  const { pointer, onPointerMove, reset } = useCardPointer(illustrationRef);
  // The story waits for the live scene's still frame, so a card showing the
  // image, as it does without WebGPU, stays still.
  const { stage, plays, onStoryEnd } = useHeldStory({ enabled: laid, onPointerMove });
  const arrow = useArrow(stage, plays, onStoryEnd, pointer, reset);

  usePauseHeroWhile(stage !== 'still');

  return (
    <LazyMotion features={domMin} strict>
      <m.div
        aria-hidden
        className={styles.illustration}
        data-arrow={arrow.leg}
        data-scene={laid ? 'laid' : 'still'}
        data-stage={stage}
        ref={illustrationRef}
        style={arrow.style}
      >
        {/* ShaderScene fills the illustration by itself. The arrow follows
            it in the DOM, so it paints on top. Phase 2 has no ending yet, so
            once a story has played, the smudge keeps easing back and the J
            does not return. */}
        {Scene && (
          <Scene
            decay={plays > 0 ? STORY_DECAY : 0}
            onStillFrame={() => setLaid(true)}
            strokeAt={arrow.strokeAt}
          />
        )}
        <Arrow />
        {!laid && (
          <Image
            alt=""
            className={styles.still}
            height={309}
            src="/features/reactive.png"
            width={312}
          />
        )}
      </m.div>
    </LazyMotion>
  );
}

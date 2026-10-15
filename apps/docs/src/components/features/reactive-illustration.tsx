'use client';

/**
 * The Reactive feature card's illustration (SHA-216): the mock's pointer
 * arrow over a live LiquidGradient with a smudge held along the J path
 * (reactive-scene.tsx), where the browser has WebGPU. Anywhere else, and
 * until the scene has laid the smudge, the card shows the image exported
 * from the mock. A hover sends the arrow off the window and back in to the
 * visitor's pointer, which it then follows, pointing the way the pointer
 * moves, while the pointer smudges the gradient. When the pointer leaves,
 * the arrow follows it off, then swoops back along the J and lays the
 * still frame's smudge again (story.tsx's held story).
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
  useMotionValueEvent,
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
  exitDistance,
  headingForAngle,
  headingToward,
  MOCK_HEIGHT,
  MOCK_WIDTH,
  pointAlong,
  shortestTurn,
  STILL_FRAME_ARROW,
  STILL_FRAME_HEADING,
  STILL_FRAME_TIP,
  swoopPose,
} from './reactive-arrow';
import styles from './reactive-illustration.module.css';
import type { ReactiveSceneProps } from './reactive-scene';
import { pointOnJ, REACTIVE_SMUDGE } from './reactive-smudge';
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

// The pose's CSS variables, which reactive-illustration.module.css reads.
type ArrowStyle = MotionStyle & {
  '--arrow-x': MotionValue<number>;
  '--arrow-y': MotionValue<number>;
  '--arrow-angle': MotionValue<number>;
};

// next/image, able to bind motion values to its style.
const MotionImage = m.create(Image);

// The mock's arrow: its body, and the light halo around it, which an
// overlay blend tints with whatever lies under it. Two elements side by
// side rather than one group, because a transform on a shared parent would
// cut the halo's blend off from the canvas beneath. Each carries the pose's
// variables itself, so a frame restyles the two images and nothing else.
function Arrow({ style }: { style: ArrowStyle }) {
  return (
    <>
      <MotionImage
        alt=""
        className={styles.pointer}
        data-part="halo"
        height={88}
        src="/features/reactive-pointer-halo.svg"
        style={style}
        width={72}
      />
      <MotionImage
        alt=""
        className={styles.pointer}
        data-part="body"
        height={88}
        src="/features/reactive-pointer.svg"
        style={style}
        width={72}
      />
    </>
  );
}

// ---------------------------------------------
// The story
// ---------------------------------------------

// How long the hover's flights take, in seconds: the arrow flicks off the
// window along its heading, then flies back in to the pointer. Leaving
// sends it off the same way.
const OUT_SECONDS = 0.25;
const IN_SECONDS = 0.35;

// How far the arrow flies out along its heading when a hover starts, in
// mock pixels: past the window's edge from the still frame's spot.
const OUT_DISTANCE = 260;

// After the arrow leaves, how long the visitor's smudges clear before it
// swoops back in, in seconds. With the flight off, about 0.6 s at decay 1,
// which brings a full pull down to nothing.
const CLEAR_SECONDS = 0.35;

// How quickly the heading follows the way the pointer moves: the time
// constant of a smoothing filter on the pointer's velocity, in seconds.
const TURN_SMOOTHING = 0.025;

// How the arrow turns to the heading: a spring with no bounce, so the
// turning speed builds and settles rather than starting at full speed. The
// filtered heading changes only when a pointer event lands, and a real
// mouse's events are uneven, so the spring also carries the turn smoothly
// through every frame between.
//
// Stiffness and damping rather than visualDuration, which would stall the
// turn on every pointer event (the time-defined-spring gotcha in
// docs/agents/docs-site.md). These are what visualDuration 0.12 with no
// bounce works out to: critically damped, settling in about 120 ms.
const TURN_SPRING = { stiffness: 1900, damping: 87, mass: 1 };

// The slowest the pointer can move, in mock pixels a second, and still
// turn the arrow. Slower is a tremble, not a direction.
const MIN_TURN_SPEED = 40;

// CursorSmudge's decay on each leg. 0 holds the J. While the visitor
// smudges, a pull loses 90% in about 1.2 s, so the J ages out and each
// stroke eases back. Once they leave, their smudges clear fast.
const HOLD_DECAY = 0;
const STORY_DECAY = 0.4;
const CLEAR_DECAY = 1;

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
 * pointer's velocity through a smoothing filter, so it turns smoothly on
 * every move, and a still or trembling pointer keeps it.
 */
function useCardPointer(illustrationRef: RefObject<HTMLDivElement | null>) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const heading = useMotionValue(STILL_FRAME_HEADING);
  const enteredAt = useRef<[number, number] | null>(null);
  // The last move, in mock pixels and seconds, and the filtered velocity,
  // in mock pixels a second. Null before the first move of a hover.
  const lastMoveRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const velocityRef = useRef<[number, number]>([0, 0]);

  const onPointerMove = (event: PointerEvent) => {
    const rect = illustrationRef.current?.getBoundingClientRect();

    if (!rect || rect.width === 0 || rect.height === 0) return;
    const nextX = ((event.clientX - rect.left) / rect.width) * MOCK_WIDTH;
    const nextY = ((event.clientY - rect.top) / rect.height) * MOCK_HEIGHT;
    const time = event.timeStamp / 1000;
    const last = lastMoveRef.current;

    x.set(nextX);
    y.set(nextY);
    lastMoveRef.current = { x: nextX, y: nextY, time };
    if (!last) {
      enteredAt.current = [nextX, nextY];
      velocityRef.current = [0, 0];

      return;
    }
    const elapsed = Math.max(time - last.time, 1 / 240);
    const keep = Math.exp(-elapsed / TURN_SMOOTHING);
    const [velocityX, velocityY] = velocityRef.current;
    const nextVelocity: [number, number] = [
      velocityX * keep + ((nextX - last.x) / elapsed) * (1 - keep),
      velocityY * keep + ((nextY - last.y) / elapsed) * (1 - keep),
    ];

    velocityRef.current = nextVelocity;
    if (Math.hypot(...nextVelocity) < MIN_TURN_SPEED) return;
    heading.set(headingToward(heading.get(), ...nextVelocity));
  };

  // Ready for the next hover. Stable, so the story's ending can list it in
  // an effect's deps.
  const reset = useCallback(() => {
    enteredAt.current = null;
    lastMoveRef.current = null;
    velocityRef.current = [0, 0];
    heading.jump(STILL_FRAME_HEADING);
  }, [heading]);

  return { pointer: { x, y, heading, enteredAt } satisfies CardPointer, onPointerMove, reset };
}

/**
 * Where the arrow is in a hover. It rests in the still frame, flies out,
 * flies back in, and follows the pointer. Once the pointer leaves, it
 * follows the pointer's way off the window, waits off it while the
 * visitor's smudges clear, then swoops back along the J.
 */
type Leg = 'resting' | 'out' | 'in' | 'following' | 'leaving' | 'clearing' | 'swooping';

/** A leg that ends when a flight or a wait does, which moves the play to the next leg. */
type TimedLeg = 'out' | 'in' | 'leaving' | 'clearing';

function legOf(stage: HeldStage, finished: TimedLeg | null): Leg {
  if (stage === 'still') return 'resting';
  if (stage === 'holding') {
    if (finished === null) return 'out';

    return finished === 'out' ? 'in' : 'following';
  }
  if (finished === 'leaving') return 'clearing';

  return finished === 'clearing' ? 'swooping' : 'leaving';
}

function decayOf(leg: Leg): number {
  if (leg === 'resting' || leg === 'swooping') return HOLD_DECAY;

  return leg === 'leaving' || leg === 'clearing' ? CLEAR_DECAY : STORY_DECAY;
}

// The tip of `pose`, in 0..1 canvas units, for a scripted stroke.
const canvasTip = (pose: ArrowPose): [number, number] => {
  const [x, y] = arrowTip(pose);

  return [x / MOCK_WIDTH, y / MOCK_HEIGHT];
};

/**
 * The arrow's part in the held story, leg by leg (Leg says what each does).
 * The tip lays a scripted stroke on the flights in and out of a hover, and
 * the swoop lays the J again. Returns the leg, the smudge's decay, the
 * pose's CSS variables, and the point a scripted stroke follows, if one
 * strokes.
 */
function useArrow(
  stage: HeldStage,
  plays: number,
  onStoryEnd: () => void,
  pointer: CardPointer,
  resetPointer: () => void,
) {
  // The last timed leg this play finished.
  const [finished, setFinished] = useState<{ play: number; leg: TimedLeg } | null>(null);
  const leg = legOf(stage, finished?.play === plays ? finished.leg : null);

  const out = useMotionValue(0);
  const flightIn = useMotionValue(0);
  const leave = useMotionValue(0);
  const swoop = useMotionValue(0);
  const entryX = useMotionValue(0);
  const entryY = useMotionValue(0);
  // Where the arrow's tip was and the way it pointed when the pointer left,
  // kept up to date while the visitor hovers, for the flight off.
  const leftX = useMotionValue(STILL_FRAME_TIP[0]);
  const leftY = useMotionValue(STILL_FRAME_TIP[1]);
  const leftHeading = useMotionValue(STILL_FRAME_HEADING);
  // The heading the arrow shows, which turns toward the pointer's.
  const turn = useSpring(pointer.heading, TURN_SPRING);

  const outPose = useTransform(out, (progress) =>
    arrowAtPointer(
      pointAlong(STILL_FRAME_TIP, STILL_FRAME_HEADING, progress * OUT_DISTANCE),
      STILL_FRAME_ARROW.angle,
    ),
  );
  // Flying in, the arrow points the way it flies, and comes round to the
  // pointer's own heading as it lands, so following picks up where it ends.
  const inPose = useTransform(() => {
    const progress = flightIn.get();
    const fromX = entryX.get();
    const fromY = entryY.get();
    const pointerX = pointer.x.get();
    const pointerY = pointer.y.get();
    const flying = (Math.atan2(pointerY - fromY, pointerX - fromX) * 180) / Math.PI;
    const heading = flying + shortestTurn(flying, turn.get()) * progress * progress;

    return arrowAtPointer(
      [fromX + (pointerX - fromX) * progress, fromY + (pointerY - fromY) * progress],
      angleForHeading(heading),
    );
  });
  const followPose = useTransform(() =>
    arrowAtPointer([pointer.x.get(), pointer.y.get()], angleForHeading(turn.get())),
  );
  const leavePose = useTransform(() => {
    const from: [number, number] = [leftX.get(), leftY.get()];
    const heading = leftHeading.get();

    return arrowAtPointer(
      pointAlong(from, heading, leave.get() * exitDistance(from, heading)),
      angleForHeading(heading),
    );
  });
  const swoopPoseValue = useTransform(swoop, swoopPose);
  // A computed motion value collects what it reads on each render, so this
  // follows only the leg the arrow is on.
  const pose = useTransform((): ArrowPose => {
    switch (leg) {
      case 'out':
        return outPose.get();
      case 'in':
        return inPose.get();
      case 'following':
        return followPose.get();
      case 'leaving':
      case 'clearing':
        return leavePose.get();
      case 'swooping':
        return swoopPoseValue.get();
      default:
        return STILL_FRAME_ARROW;
    }
  });
  // One point per stroking leg, so the scene starts a fresh stroke on each
  // rather than drawing one across the window from where the last left off.
  const outTip = useTransform(outPose, canvasTip);
  const inTip = useTransform(inPose, canvasTip);
  const jPoint = useTransform(swoop, pointOnJ);

  // While the visitor hovers, keep where the arrow is, so it leaves from
  // there whichever leg it was on.
  const hoveringRef = useRef(false);

  useEffect(() => {
    hoveringRef.current = stage === 'holding';
  }, [stage]);
  useMotionValueEvent(pose, 'change', (current) => {
    if (!hoveringRef.current) return;
    const [tipX, tipY] = arrowTip(current);

    leftX.set(tipX);
    leftY.set(tipY);
    leftHeading.set(headingForAngle(current.angle));
  });

  // The scene attaches a stroking leg's point in an effect of its own, in
  // the render where the leg starts, reading where the point is as the
  // stroke's start. A child's effects run before its parent's, so a flight
  // never runs ahead of the attach. Each leg's point is set up before its
  // leg starts.
  useEffect(() => {
    const finish = (timed: TimedLeg) => setFinished({ play: plays, leg: timed });
    const run = (value: MotionValue<number>, duration: number, then: () => void) => {
      const controls = animate(value, 1, { duration, ease: EASE_OUT });

      void controls.then(then);

      return () => controls.stop();
    };

    switch (leg) {
      case 'out':
        return run(out, OUT_SECONDS, () => {
          const [fromX, fromY] = entryPoint(
            pointer.enteredAt.current ?? [pointer.x.get(), pointer.y.get()],
          );

          entryX.jump(fromX);
          entryY.jump(fromY);
          flightIn.jump(0);
          finish('out');
        });
      case 'in':
        return run(flightIn, IN_SECONDS, () => finish('in'));
      case 'leaving':
        return run(leave, OUT_SECONDS, () => finish('leaving'));
      case 'clearing': {
        const wait = window.setTimeout(() => {
          swoop.jump(0);
          finish('clearing');
        }, CLEAR_SECONDS * 1000);

        return () => window.clearTimeout(wait);
      }
      case 'swooping':
        return run(swoop, REACTIVE_SMUDGE.laySeconds, () => {
          out.jump(0);
          leave.jump(0);
          resetPointer();
          turn.jump(STILL_FRAME_HEADING);
          onStoryEnd();
        });
      default:
        return undefined;
    }
  }, [
    leg,
    plays,
    out,
    flightIn,
    leave,
    swoop,
    entryX,
    entryY,
    pointer,
    resetPointer,
    turn,
    onStoryEnd,
  ]);

  const style: ArrowStyle = {
    '--arrow-x': useTransform(pose, ({ x }) => x),
    '--arrow-y': useTransform(pose, ({ y }) => y),
    '--arrow-angle': useTransform(pose, ({ angle }) => angle),
  };
  let strokeAt: MotionValue<[number, number]> | null = null;

  if (leg === 'out') strokeAt = outTip;
  else if (leg === 'in') strokeAt = inTip;
  else if (leg === 'swooping') strokeAt = jPoint;

  return { leg, decay: decayOf(leg), style, strokeAt };
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
      <div
        aria-hidden
        className={styles.illustration}
        data-arrow={arrow.leg}
        data-scene={laid ? 'laid' : 'still'}
        data-stage={stage}
        ref={illustrationRef}
      >
        {/* ShaderScene fills the illustration by itself. The arrow follows
            it in the DOM, so it paints on top. */}
        {Scene && (
          <Scene decay={arrow.decay} onStillFrame={() => setLaid(true)} strokeAt={arrow.strokeAt} />
        )}
        <Arrow style={arrow.style} />
        {!laid && (
          <Image
            alt=""
            className={styles.still}
            height={309}
            src="/features/reactive.png"
            width={312}
          />
        )}
      </div>
    </LazyMotion>
  );
}

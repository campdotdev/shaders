'use client';

/**
 * The Reactive feature card's illustration (SHA-216): the mock's pointer
 * arrow over a live LiquidGradient with a smudge held along the J path
 * (reactive-scene.tsx), where the browser has WebGPU and motion is allowed.
 * Anywhere else, and until the scene has laid the smudge, the card shows an
 * image captured from that still frame. A hover sends the arrow off the
 * window and back in to the visitor's pointer, which it then follows,
 * pointing the way the pointer moves, while its tip smudges the gradient.
 * When the pointer leaves, the arrow follows it off, then swoops back along
 * the J and lays the still frame's smudge again. A touch that scrolls the
 * page over the card hides the arrow and stirs the smudge until the page
 * stops (story.tsx's held story).
 */
import Image from 'next/image';
import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';

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

import { EASE_OUT } from '@/lib/easing';

import { createLiveScene } from './live-scene';
import {
  angleForHeading,
  arrowAtPointer,
  type ArrowPose,
  arrowTip,
  entryPoint,
  exitDistance,
  headingForAngle,
  headingToward,
  pointAlong,
  shortestTurn,
  STILL_FRAME_ARROW,
  STILL_FRAME_HEADING,
  STILL_FRAME_TIP,
  swoopPose,
} from './reactive-arrow';
import styles from './reactive-illustration.module.css';
import { MOCK_HEIGHT, MOCK_WIDTH, pointOnJ, REACTIVE_SMUDGE } from './reactive-smudge';
import { type HeldBy, type HeldStage, type HeldStory, useHeldStory } from './story';

// ---------------------------------------------
// The scene
// ---------------------------------------------

// The live scene, where it may run (live-scene.ts).
const useReactiveScene = createLiveScene(() => import('./reactive-scene'));

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
// sends it off the same way. Longer reads as a lazier handoff, shorter as a
// snap.
const OUT_SECONDS = 0.25;
const IN_SECONDS = 0.35;

// How far the arrow flies out along its heading when a hover starts, in
// mock pixels: past the window's edge from the still frame's spot.
const OUT_DISTANCE = 260;

// How long the visitor's smudges clear at decay 1 once the arrow is off the
// window, before it swoops back in, in seconds. A hover's flight off adds
// OUT_SECONDS first, and a push, whose arrow is already hidden, waits both,
// so a full pull always has about 0.6 s to clear to nothing. Shorter
// leaves a faint smudge for the swoop's decay 0 to hold.
const CLEAR_SECONDS = 0.35;

// How quickly the heading follows the way the pointer moves: the time
// constant of a smoothing filter on the pointer's velocity, in seconds.
// Longer steadies the heading against a trembling mouse and turns later.
const TURN_SMOOTHING = 0.025;

// The shortest gap between two pointer events the velocity counts, in
// seconds. A browser can deliver two events at the same timestamp, and the
// velocity would then divide by zero.
const MIN_EVENT_GAP = 1 / 240;

// How the arrow turns to the heading: a spring with no bounce, so the
// turning speed builds and settles rather than starting at full speed. The
// filtered heading changes only when a pointer event lands, and a real
// mouse's events are uneven, so the spring also carries the turn smoothly
// through every frame between.
//
// Stiffness and damping rather than visualDuration, which would stall the
// turn on every pointer event (the time-defined-spring gotcha in
// docs/agents/docs-site.md). Critical damping keeps the turn bounce-free.
// A turn from rest covers about 95% in 240 ms, then eases through its last
// few degrees. Lower stiffness stretches that settle; damping is twice
// the square root of stiffness at mass 1 to keep the same response.
const TURN_SPRING = { stiffness: 400, damping: 40, mass: 1 };

// Smooth the pointer's position between mouse events. At mass 1, damping
// 50 critically damps stiffness 625: about 95% of a move in 190 ms, with
// no bounce. Position catches up a little sooner than the arrow's turn.
const FOLLOW_SPRING = { stiffness: 625, damping: 50, mass: 1 };

// The slowest the pointer can move, in mock pixels a second, and still
// turn the arrow. Slower is a tremble, not a direction. Higher holds the
// heading through slow drags too.
const MIN_TURN_SPEED = 40;

/** The eased pointer over the card, in mock pixels, and the way the mouse heads. */
interface CardPointer {
  x: MotionValue<number>;
  y: MotionValue<number>;
  /** In degrees with y down, unwrapped, so following it always turns the short way. */
  heading: MotionValue<number>;
  /** Where the pointer was when the hover started, or null before it has. */
  enteredAt: RefObject<[number, number] | null>;
}

/**
 * Eases the pointer's position toward each mouse move without restarting
 * its velocity. The heading follows the raw mouse velocity through a
 * smoothing filter, and a still or trembling mouse keeps its heading.
 */
function useEasedPointer(illustrationRef: RefObject<HTMLDivElement | null>) {
  const targetX = useMotionValue(0);
  const targetY = useMotionValue(0);
  const x = useSpring(targetX, FOLLOW_SPRING);
  const y = useSpring(targetY, FOLLOW_SPRING);
  const heading = useMotionValue(STILL_FRAME_HEADING);
  const enteredAt = useRef<[number, number] | null>(null);
  // Stable, so a re-render never restarts a leg that lists it in its deps.
  const pointer = useMemo<CardPointer>(() => ({ x, y, heading, enteredAt }), [x, y, heading]);
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

    targetX.set(nextX);
    targetY.set(nextY);
    lastMoveRef.current = { x: nextX, y: nextY, time };
    if (!last) {
      // Start each hover at its entry point, without carrying motion from
      // the previous hover into the arrow's flight back in.
      x.jump(nextX);
      y.jump(nextY);
      enteredAt.current = [nextX, nextY];
      velocityRef.current = [0, 0];

      return;
    }
    const elapsed = Math.max(time - last.time, MIN_EVENT_GAP);
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

  return { pointer, onPointerMove, reset };
}

/**
 * Where the arrow is in the story. It rests in the still frame. A hover
 * sends it out, back in, and following the pointer. A scroll push hides it
 * where it rests while the touch stirs the smudge. Once the hover or the
 * push ends, it leaves the way the pointer did, if it was following, waits
 * off the window while the smudges clear, then swoops back along the J.
 */
type Leg = 'resting' | 'out' | 'in' | 'following' | 'pushing' | 'leaving' | 'clearing' | 'swooping';

/** A leg that ends when a flight or a wait does, which moves the play to the next leg. */
type TimedLeg = 'out' | 'in' | 'leaving' | 'clearing';

function legOf(stage: HeldStage, heldBy: HeldBy, finished: TimedLeg | null): Leg {
  if (stage === 'still') return 'resting';
  if (stage === 'holding') {
    if (heldBy === 'push') return 'pushing';
    if (finished === null) return 'out';

    return finished === 'out' ? 'in' : 'following';
  }
  if (finished === 'clearing') return 'swooping';
  // A push ending skips the flight off: the arrow is already hidden.
  if (finished === 'leaving' || heldBy === 'push') return 'clearing';

  return 'leaving';
}

// CursorSmudge's decay on each leg. 0 holds the J, at rest and as the
// swoop lays it again. While the visitor smudges, 0.4 takes 90% of a pull
// away in about 1.2 s, so the J ages out and each stroke eases back. Once
// they leave, 1 clears their smudges fast.
const DECAY: Record<Leg, number> = {
  resting: 0,
  out: 0.4,
  in: 0.4,
  following: 0.4,
  pushing: 0.4,
  leaving: 1,
  clearing: 1,
  swooping: 0,
};

// The tip of `pose`, in 0..1 canvas units, for a scripted stroke.
const canvasTip = (pose: ArrowPose): [number, number] => {
  const [x, y] = arrowTip(pose);

  return [x / MOCK_WIDTH, y / MOCK_HEIGHT];
};

/** The progress of each leg's flight, from 0 to 1, and the points the flights start from. */
interface Flights {
  out: MotionValue<number>;
  flightIn: MotionValue<number>;
  leave: MotionValue<number>;
  swoop: MotionValue<number>;
  entryX: MotionValue<number>;
  entryY: MotionValue<number>;
  /** Where the arrow's tip is and the way it points, while the story holds. */
  leftX: MotionValue<number>;
  leftY: MotionValue<number>;
  leftHeading: MotionValue<number>;
}

// Stable, so a re-render never restarts a leg that lists it in its deps.
function useFlights(): Flights {
  const out = useMotionValue(0);
  const flightIn = useMotionValue(0);
  const leave = useMotionValue(0);
  const swoop = useMotionValue(0);
  const entryX = useMotionValue(0);
  const entryY = useMotionValue(0);
  const leftX = useMotionValue(STILL_FRAME_TIP[0]);
  const leftY = useMotionValue(STILL_FRAME_TIP[1]);
  const leftHeading = useMotionValue(STILL_FRAME_HEADING);

  return useMemo(
    () => ({ out, flightIn, leave, swoop, entryX, entryY, leftX, leftY, leftHeading }),
    [out, flightIn, leave, swoop, entryX, entryY, leftX, leftY, leftHeading],
  );
}

/**
 * The arrow's pose on each leg that moves it, and the point each stroking
 * leg's scripted stroke follows. `turn` is the heading the arrow shows.
 */
function useArrowPoses(pointer: CardPointer, turn: MotionValue<number>, flights: Flights) {
  const { out, flightIn, leave, swoop, entryX, entryY, leftX, leftY, leftHeading } = flights;
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
  const swoopingPose = useTransform(swoop, swoopPose);

  return {
    poses: { outPose, inPose, followPose, leavePose, swoopingPose },
    // One point per stroking leg, so the scene starts a fresh stroke on each
    // rather than drawing one across the window from where the last left
    // off. The smudge follows the eased tip while the arrow follows the
    // pointer, rather than the raw mouse ahead of it.
    tips: {
      outTip: useTransform(outPose, canvasTip),
      inTip: useTransform(inPose, canvasTip),
      followTip: useTransform(followPose, canvasTip),
      jPoint: useTransform(swoop, pointOnJ),
    },
  };
}

/**
 * Runs each timed leg's flight or wait, then moves the play on, and ends
 * the story once the swoop lands. The scene attaches a stroking leg's point
 * in an effect of its own, in the render where the leg starts, reading
 * where the point is as the stroke's start. A child's effects run before
 * its parent's, so a flight never runs ahead of the attach, and each leg's
 * point is set up before its leg starts.
 */
function useLegTimeline(
  leg: Leg,
  { plays, heldBy, onStoryEnd }: HeldStory,
  finish: (timed: TimedLeg) => void,
  {
    pointer,
    flights,
    turn,
    resetPointer,
  }: {
    pointer: CardPointer;
    flights: Flights;
    turn: MotionValue<number>;
    resetPointer: () => void;
  },
) {
  useEffect(() => {
    const { out, flightIn, leave, swoop, entryX, entryY } = flights;
    const run = (value: MotionValue<number>, duration: number, then: () => void) => {
      const controls = animate(value, 1, { duration, ease: EASE_OUT });

      void controls.then(then);

      return () => controls.stop();
    };
    const steps: Partial<Record<Leg, () => () => void>> = {
      out: () =>
        run(out, OUT_SECONDS, () => {
          const [fromX, fromY] = entryPoint(
            pointer.enteredAt.current ?? [pointer.x.get(), pointer.y.get()],
          );

          entryX.jump(fromX);
          entryY.jump(fromY);
          flightIn.jump(0);
          finish('out');
        }),
      in: () => run(flightIn, IN_SECONDS, () => finish('in')),
      leaving: () => run(leave, OUT_SECONDS, () => finish('leaving')),
      clearing: () => {
        const seconds = heldBy === 'push' ? OUT_SECONDS + CLEAR_SECONDS : CLEAR_SECONDS;
        const wait = window.setTimeout(() => {
          swoop.jump(0);
          finish('clearing');
        }, seconds * 1000);

        return () => window.clearTimeout(wait);
      },
      swooping: () =>
        run(swoop, REACTIVE_SMUDGE.laySeconds, () => {
          out.jump(0);
          leave.jump(0);
          resetPointer();
          turn.jump(STILL_FRAME_HEADING);
          onStoryEnd();
        }),
    };

    return steps[leg]?.();
  }, [leg, plays, heldBy, finish, pointer, flights, turn, resetPointer, onStoryEnd]);
}

// After a push the arrow waits hidden in its spot while the smudges clear,
// so it shows again only as it swoops back in.
const isHidden = (leg: Leg, heldBy: HeldBy) =>
  leg === 'pushing' || (leg === 'clearing' && heldBy === 'push');

/** The arrow's pose on the leg it is on, or the still frame's on a leg that doesn't move it. */
function useLegPose(
  leg: Leg,
  heldBy: HeldBy,
  poses: ReturnType<typeof useArrowPoses>['poses'],
): MotionValue<ArrowPose> {
  // After a hover the arrow waits where it left the window. After a push it
  // waits hidden in its spot.
  const clearingPose = heldBy === 'push' ? null : poses.leavePose;
  const poseOn: Record<Leg, MotionValue<ArrowPose> | null> = {
    resting: null,
    out: poses.outPose,
    in: poses.inPose,
    following: poses.followPose,
    pushing: null,
    leaving: poses.leavePose,
    clearing: clearingPose,
    swooping: poses.swoopingPose,
  };
  const legPose = poseOn[leg];

  // A computed motion value collects what it reads on each render, so this
  // follows only the leg the arrow is on.
  return useTransform((): ArrowPose => legPose?.get() ?? STILL_FRAME_ARROW);
}

/**
 * While the story holds, keeps where the arrow's tip is and the way it
 * points, so it leaves from there whichever leg it was on.
 */
function useHeldTip(pose: MotionValue<ArrowPose>, stage: HeldStage, flights: Flights) {
  const holdingRef = useRef(false);

  useEffect(() => {
    holdingRef.current = stage === 'holding';
  }, [stage]);
  useMotionValueEvent(pose, 'change', (current) => {
    if (!holdingRef.current) return;
    const [tipX, tipY] = arrowTip(current);

    flights.leftX.set(tipX);
    flights.leftY.set(tipY);
    flights.leftHeading.set(headingForAngle(current.angle));
  });
}

/**
 * The arrow's part in the held story, leg by leg (Leg says what each does).
 * The tip lays a scripted stroke on the flights in and out of a hover and
 * while the arrow follows the pointer, and the swoop lays the J again.
 * Returns the leg, whether a push hides the arrow, the smudge's decay, the
 * pose's CSS variables, and the point a scripted stroke follows, if one
 * strokes.
 */
function useArrow(story: HeldStory, pointer: CardPointer, resetPointer: () => void) {
  const { stage, plays, heldBy } = story;
  // The last timed leg this play finished.
  const [finished, setFinished] = useState<{ play: number; leg: TimedLeg } | null>(null);
  const leg = legOf(stage, heldBy, finished?.play === plays ? finished.leg : null);
  const finish = useCallback(
    (timed: TimedLeg) => setFinished({ play: plays, leg: timed }),
    [plays],
  );
  const flights = useFlights();
  // The heading the arrow shows, which turns toward the pointer's.
  const turn = useSpring(pointer.heading, TURN_SPRING);
  const { poses, tips } = useArrowPoses(pointer, turn, flights);
  const pose = useLegPose(leg, heldBy, poses);
  // A point that never moves, attached while the card rests: a scripted
  // stroke beats the mouse and the push, so a pointer on the card before
  // the story starts, or a mouse that fails the hover gate, can't smudge
  // the still frame its decay 0 holds.
  const stillPoint = useMotionValue<[number, number]>([0.5, 0.5]);

  useHeldTip(pose, stage, flights);
  useLegTimeline(leg, story, finish, { pointer, flights, turn, resetPointer });

  const strokeOn: Record<Leg, MotionValue<[number, number]> | null> = {
    resting: stillPoint,
    out: tips.outTip,
    in: tips.inTip,
    following: tips.followTip,
    pushing: null,
    leaving: null,
    clearing: null,
    swooping: tips.jPoint,
  };
  const style: ArrowStyle = {
    '--arrow-x': useTransform(pose, ({ x }) => x),
    '--arrow-y': useTransform(pose, ({ y }) => y),
    '--arrow-angle': useTransform(pose, ({ angle }) => angle),
  };

  return {
    leg,
    hidden: isHidden(leg, heldBy),
    decay: DECAY[leg],
    style,
    strokeAt: strokeOn[leg],
  };
}

// ---------------------------------------------
// The illustration
// ---------------------------------------------

// Hidden from screen readers: the card's title and description carry its
// message. `data-scene` says whether the live scene shows the still frame,
// `data-stage` where the story is, `data-arrow` where the arrow is in it,
// and `data-arrow-hidden` whether a push has hidden it.
//
// `m` under LazyMotion rather than `motion`, as in the other feature cards:
// the illustration only binds motion values to style, which domMin covers.
export function ReactiveIllustration() {
  const Scene = useReactiveScene();
  // Whether the live scene shows the still frame. It doesn't until the J is
  // laid, nor while a new renderer or a resize lays it again.
  const [stillFrameReady, setStillFrameReady] = useState(false);
  const live = Scene !== null && stillFrameReady;
  const illustrationRef = useRef<HTMLDivElement>(null);
  const { pointer, onPointerMove, reset } = useEasedPointer(illustrationRef);
  // The story waits for the live still frame, so a card showing the image,
  // as it does without WebGPU and under reduced motion, stays still.
  const story = useHeldStory({ enabled: live, onPointerMove, pausesHero: true });
  const arrow = useArrow(story, pointer, reset);

  return (
    <LazyMotion features={domMin} strict>
      <div
        aria-hidden
        className={styles.illustration}
        data-arrow={arrow.leg}
        data-arrow-hidden={arrow.hidden || undefined}
        data-scene={live ? 'laid' : 'still'}
        data-stage={story.stage}
        ref={illustrationRef}
      >
        {/* ShaderScene fills the illustration by itself. The arrow follows
            it in the DOM, so it paints on top. */}
        {Scene && (
          <Scene
            decay={arrow.decay}
            onPushEnd={story.onPushEnd}
            onPushStart={story.onPushStart}
            onStillFrameChange={setStillFrameReady}
            resting={arrow.leg === 'resting'}
            strokeAt={arrow.strokeAt}
          />
        )}
        <Arrow style={arrow.style} />
        {!live && (
          <Image
            alt=""
            className={styles.still}
            height={MOCK_HEIGHT}
            src="/features/reactive.png"
            width={MOCK_WIDTH}
          />
        )}
      </div>
    </LazyMotion>
  );
}

'use client';

/**
 * The Performant feature card's illustration: the Figma mock's GPU chip,
 * alone and half again its size, as the author settled during SHA-215. The
 * still frame shows the chip idle and gray. Its story warms the chip and
 * starts a band of work flowing under it, which runs while the pointer
 * stays. story.tsx says when each part plays.
 */
import { type CSSProperties, useEffect } from 'react';

import {
  animate,
  type AnimationSequence,
  domMin,
  LazyMotion,
  m,
  type MotionStyle,
  type MotionValue,
  useAnimationFrame,
  useMotionValue,
  useTransform,
} from 'motion/react';

import { EASE_OUT } from '@/lib/easing';

import styles from './performant-illustration.module.css';
import { type HeldStage, useHeldStory } from './story';

// ---------------------------------------------
// The chip
// ---------------------------------------------

// How lit the chip is, from 0, the mock's gray chip, to 1, the mock's
// glowing one. performant-illustration.module.css mixes every layer of the
// chip by it.
type LitStyle = MotionStyle & { '--lit': MotionValue<number> };

// The four pins along the chip's top or bottom edge.
function Pins({ edge }: { edge: 'top' | 'bottom' }) {
  return (
    <div className={styles.pins} data-edge={edge}>
      <span className={styles.pin} />
      <span className={styles.pin} />
      <span className={styles.pin} />
      <span className={styles.pin} />
    </div>
  );
}

// The chip: its body, three nested squares that step lighter toward the
// center, with its name in the middle and four pins above and below. The
// glow and the lit center are separate layers, because a lit chip blends
// its layers differently from a gray one. The glow comes first, so both
// rows of pins paint over its halo and pick up its color.
function Chip({ lit }: { lit: MotionValue<number> }) {
  const style: LitStyle = { '--lit': lit };

  return (
    <m.div className={styles.chip} style={style}>
      <span className={styles.glow} />
      <Pins edge="top" />
      <div className={styles.body}>
        <div className={styles.ring}>
          <div className={styles.core}>
            <span className={styles.coreLit} />
            <span className={styles.name}>GPU</span>
          </div>
        </div>
      </div>
      <Pins edge="bottom" />
    </m.div>
  );
}

// ---------------------------------------------
// The work
// ---------------------------------------------

/** A particle in the band of work under the chip. */
interface Particle {
  /** Names the particle: its place in the band's fill order. */
  id: number;
  /** The particle's left edge, in percent of the band's width. */
  left: number;
  /**
   * A large particle is the mock's 6 by 8 in the glow's pink, and a small
   * one the mock's 4 by 5 in the deeper pink.
   */
  size: 'large' | 'small';
  /** How strongly the particle shows once it has faded in, from 0 to 1. */
  opacity: number;
  /** An `up` particle rises into the chip, and a `down` one falls out of it. */
  direction: 'up' | 'down';
  /** Trips across the band per second at the band's full pace. */
  speed: number;
  /** Where in its trip the particle is at the start of a play, from 0 to 1. */
  phase: number;
}

// The share of particles that rise into the chip. The rest fall out of it.
const RISING_SHARE = 0.6;

// The share of particles that are the mock's large ones.
const LARGE_SHARE = 0.4;

// The strengths a particle shows at, picked at random, so the band layers
// like the reference: some bright, some faint.
const OPACITIES = [1, 0.6, 0.35] as const;

// The range of particle speeds, in trips across the band per second at
// full pace. A trip is the band's height, about 75 mock pixels.
const SLOWEST_SPEED = 0.9;
const FASTEST_SPEED = 1.8;

// The band is 84 mock pixels wide and a particle at most 6, so a particle's
// left edge stays within the first 78.
const LANE_PERCENT = (78 / 84) * 100;

/**
 * A seeded random number generator (mulberry32), so the particles land in
 * the same places on every render, on the server and in the browser.
 */
function seededRandom(seed: number): () => number {
  let state = seed;

  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);

    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;

    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

/** The band's particles, scattered at random from `seed`. */
function scatterParticles(seed: number, count: number): readonly Particle[] {
  const random = seededRandom(seed);

  return Array.from({ length: count }, (_, id) => ({
    id,
    left: random() * LANE_PERCENT,
    size: random() < LARGE_SHARE ? 'large' : 'small',
    opacity: OPACITIES[Math.floor(random() * OPACITIES.length)] ?? 1,
    direction: random() < RISING_SHARE ? 'up' : 'down',
    speed: SLOWEST_SPEED + random() * (FASTEST_SPEED - SLOWEST_SPEED),
    phase: random(),
  }));
}

// How many particles the band holds. More crowd it.
const PARTICLE_COUNT = 30;

const PARTICLES = scatterParticles(215, PARTICLE_COUNT);

/**
 * Where a particle is down the band, from 0 at the chip's pins to 1 past
 * the window's bottom edge, once the band's flow has run `trips` trips at
 * full pace. A trip that runs off one end starts again at the other.
 */
function bandPosition(particle: Particle, trips: number): number {
  const progress = (particle.phase + particle.speed * trips) % 1;

  return particle.direction === 'up' ? 1 - progress : progress;
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * A particle on its lane: a strip the band's full height, which the flow
 * moves down by a share of its own height, so a step is the same share of
 * the band at every card width. It fades in as the band's count of showing
 * particles passes its place in the band, so the band fills in one particle
 * after another.
 */
function WorkParticle({
  particle,
  flow,
  shown,
}: {
  particle: Particle;
  flow: MotionValue<number>;
  shown: MotionValue<number>;
}) {
  const y = useTransform(flow, (trips) => `${bandPosition(particle, trips) * 100}%`);
  const opacity = useTransform(shown, (count) => particle.opacity * clampUnit(count - particle.id));
  const laneStyle: CSSProperties = { left: `${particle.left}%` };

  return (
    <m.span className={styles.lane} style={{ ...laneStyle, y, opacity }}>
      <span className={styles.particle} data-size={particle.size} />
    </m.span>
  );
}

/**
 * The band of work under the chip. Its flow runs on a clock of its own,
 * which advances by the band's pace every frame, so the pace can ease up
 * without the particles jumping.
 */
function WorkBand({ pace, shown }: { pace: MotionValue<number>; shown: MotionValue<number> }) {
  // How many trips the band's flow has run at full pace.
  const flow = useMotionValue(0);

  useAnimationFrame((_, deltaMs) => {
    flow.set(flow.get() + (pace.get() * deltaMs) / 1000);
  });

  return (
    <div className={styles.band}>
      {PARTICLES.map((particle) => (
        <WorkParticle flow={flow} key={particle.id} particle={particle} shown={shown} />
      ))}
    </div>
  );
}

// ---------------------------------------------
// The story's timing
// ---------------------------------------------

// From the motion brief on SHA-215, as the author tuned it in the dev
// server. The chip warms while the band fills in and gets up to pace.
// Everything here enters, so it all eases out. Durations are in seconds,
// as Motion takes them.

// How long the chip takes to warm and the band to fill in and get up to
// pace.
const WARM_SECONDS = 0.3;

// ---------------------------------------------
// The story
// ---------------------------------------------

/**
 * One play of the story: the band of work, mounted fresh for each play and
 * gone on the still frame, so nothing runs a frame loop at rest. It warms
 * the chip, which stays mounted, through its --lit.
 */
function Play({
  stage,
  lit,
  onOpeningEnd,
  onStoryEnd,
}: {
  stage: HeldStage;
  lit: MotionValue<number>;
  onOpeningEnd: () => void;
  onStoryEnd: () => void;
}) {
  // The band's pace, as a share of full pace: 0 stopped.
  const pace = useMotionValue(0);
  // How many of the band's particles show, counted in order.
  const shown = useMotionValue(0);

  // The opening, as one timeline: the chip warms, and the band fills in and
  // gets up to pace. A fresh play mounts for each opening, and the motion
  // values and callbacks never change, so this runs once per play.
  useEffect(() => {
    if (stage !== 'opening') return undefined;

    const warm = { duration: WARM_SECONDS, ease: EASE_OUT, at: 0 };
    const opening: AnimationSequence = [
      [lit, 1, warm],
      [shown, PARTICLE_COUNT, warm],
      [pace, 1, warm],
    ];
    const controls = animate(opening);
    let stopped = false;

    void controls.then(() => {
      if (!stopped) onOpeningEnd();
    });

    return () => {
      stopped = true;
      controls.stop();
    };
  }, [stage, lit, pace, shown, onOpeningEnd]);

  // For now the ending cuts straight back to the still frame. The drain
  // replaces it in the next phase.
  useEffect(() => {
    if (stage !== 'ending') return;

    lit.set(0);
    onStoryEnd();
  }, [stage, lit, onStoryEnd]);

  return <WorkBand pace={pace} shown={shown} />;
}

// ---------------------------------------------
// The illustration
// ---------------------------------------------

// Hidden from screen readers: the card's title and description carry its
// message. The chip stays mounted and takes its glow from the play, which
// mounts fresh for each opening, keyed by the play's count.
//
// `m` under LazyMotion rather than `motion`, as in the Extensible card: the
// chip and the particles only bind motion values to style, which domMin
// covers.
export function PerformantIllustration() {
  const { stage, plays, onOpeningEnd, onStoryEnd } = useHeldStory();
  const lit = useMotionValue(0);

  return (
    <div aria-hidden className={styles.illustration}>
      <LazyMotion features={domMin} strict>
        {stage !== 'still' && (
          <Play
            key={plays}
            lit={lit}
            onOpeningEnd={onOpeningEnd}
            onStoryEnd={onStoryEnd}
            stage={stage}
          />
        )}
        <Chip lit={lit} />
      </LazyMotion>
    </div>
  );
}

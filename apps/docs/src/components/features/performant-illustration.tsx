'use client';

/**
 * The Performant feature card's illustration: the Figma mock's GPU chip,
 * alone, half again its size, and lit. The still frame shows the chip
 * softly lit, with no work under it. Its story (SHA-215) streams a band of
 * work into and out of the chip's pins and brings the glow up while the
 * pointer stays, then lets the band run dry and the glow settle. story.tsx
 * says when each part plays.
 */
import { type CSSProperties, useEffect, useRef, useState } from 'react';

import {
  cancelFrame,
  cubicBezier,
  domMin,
  frame,
  LazyMotion,
  m,
  type MotionStyle,
  type MotionValue,
  motionValue,
  useMotionValue,
  useTransform,
} from 'motion/react';

import { EASE_OUT } from '@/lib/easing';

import styles from './performant-illustration.module.css';
import { type HeldStage, useHeldStory } from './story';

// ---------------------------------------------
// The chip
// ---------------------------------------------

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

// The halo's strength, from 0, none, to 1, the mock's full glow.
// performant-illustration.module.css fades the halo by it.
type HaloStyle = MotionStyle & { '--halo': MotionValue<number> };

// The chip: its body, three nested squares that step lighter toward the
// center, with its name in the middle and four pins above and below. The
// glow's two layers come first, so both rows of pins paint over the halo
// and pick up its color.
function Chip({ halo }: { halo: MotionValue<number> }) {
  const style: HaloStyle = { '--halo': halo };

  return (
    <m.div className={styles.chip} style={style}>
      <span className={styles.halo} />
      <span className={styles.fill} />
      <Pins edge="top" />
      <div className={styles.body}>
        <div className={styles.ring}>
          <div className={styles.core}>
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
  /** Names the particle, for its React key. */
  id: number;
  /** The particle's left edge, in percent of the band's width. */
  left: number;
  /**
   * A large particle is the mock's 6 by 8 in the glow's pink, and a small
   * one the mock's 4 by 5 in the deeper pink.
   */
  size: 'large' | 'small';
  /** How strongly the particle shows, from 0 to 1. */
  opacity: number;
  /** An `up` particle rises into the chip, and a `down` one falls out of it. */
  direction: 'up' | 'down';
  /** Trips across the band per second. */
  speed: number;
  /** Seconds from the hover until the particle first enters the band. */
  delay: number;
}

// How many particles the band holds once it has filled. More crowd it.
const PARTICLE_COUNT = 30;

// How long the band takes to fill, in seconds: the last particle enters by
// then. Longer streams the work in more gradually.
const FILL_SECONDS = 0.8;

// The share of particles that rise into the chip. The rest fall out of it.
const RISING_SHARE = 0.6;

// The share of particles that are the mock's large ones, in the paler pink.
// Higher makes the band heavier and paler, lower finer and deeper pink.
const LARGE_SHARE = 0.4;

// The strengths a particle shows at, picked at random, so the band layers
// like the reference: some bright, some faint. Fainter strengths give the
// band more depth and less punch.
const OPACITIES = [1, 0.6, 0.35] as const;

// The range of particle speeds, in trips per second. A trip runs the
// particle's lane, from one end to the other: the band's height plus a
// particle's, about 74 mock pixels. Faster speeds make the band busier and
// shorten the drain, which takes one trip of the slowest particle at most.
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

/**
 * The band's particles, scattered at random from `seed`. Their entries
 * spread evenly across the fill, each at a random moment within its share,
 * so the band fills steadily rather than in bursts.
 */
function scatterParticles(seed: number): readonly Particle[] {
  const random = seededRandom(seed);

  return Array.from({ length: PARTICLE_COUNT }, (_, id) => ({
    id,
    left: random() * LANE_PERCENT,
    size: random() < LARGE_SHARE ? 'large' : 'small',
    opacity: OPACITIES[Math.floor(random() * OPACITIES.length)] ?? 1,
    direction: random() < RISING_SHARE ? 'up' : 'down',
    speed: SLOWEST_SPEED + random() * (FASTEST_SPEED - SLOWEST_SPEED),
    delay: (FILL_SECONDS * (id + random())) / PARTICLE_COUNT,
  }));
}

// Any fixed seed works, and 215, the ticket's number, is as good as any.
// Another seed reshuffles the band.
const PARTICLES = scatterParticles(215);

/**
 * Where a particle is down its lane, from 0 at the top to 1 at the bottom,
 * once it has run `trips` trips. A trip starts at the particle's entry end,
 * just outside the band: under the window's edge for a particle that rises,
 * and above the band, under the chip's pins, for one that falls. A trip
 * that runs off one end starts again at the other, so a whole number of
 * trips puts the particle back at its entry end.
 */
function bandPosition(direction: Particle['direction'], trips: number): number {
  const progress = trips - Math.floor(trips);

  return direction === 'up' ? 1 - progress : progress;
}

/**
 * A particle on its lane: a strip a little taller than the band, which the
 * particle's trips move down by a share of its own height, so a step is the
 * same share of the band at every card width. The particle shows only while
 * it is on a trip. Before its first, and once the ending stops it at the end
 * of one, it waits at its entry end: just outside the band, and transparent
 * besides, because a clip at the band's edge can let a pixel's sliver
 * through.
 */
function WorkParticle({ particle, trips }: { particle: Particle; trips: MotionValue<number> }) {
  const y = useTransform(trips, (run) => `${bandPosition(particle.direction, run) * 100}%`);
  const opacity = useTransform(trips, (run) => (run > 0 && run % 1 !== 0 ? particle.opacity : 0));
  const laneStyle: CSSProperties = { left: `${particle.left}%` };

  return (
    <m.span className={styles.lane} style={{ ...laneStyle, y, opacity }}>
      <span className={styles.particle} data-size={particle.size} />
    </m.span>
  );
}

// ---------------------------------------------
// The story
// ---------------------------------------------

// From the motion brief on SHA-215. Every particle moves at a constant
// speed, so only the glow eases: with the site's --ease-out, as anything
// warming or cooling does.

// The halo's strength on the still frame, from 0, none, to 1, the mock's
// full glow, which it rises to as the band fills. Lower makes the hover's
// lift bigger.
const STILL_FRAME_HALO = 0.4;

// The shortest the halo takes to settle back once the pointer leaves, in
// seconds. It settles over the band's drain, so it lands as the last
// particle leaves, but takes at least this long when the drain is quicker.
const SHORTEST_SETTLE_SECONDS = 0.4;

const easeOut = cubicBezier(...EASE_OUT);

/** A particle and how many trips it has run this play. */
interface BandParticle {
  particle: Particle;
  trips: MotionValue<number>;
}

/**
 * Runs the band's flow and the glow for one play, from the hover until the
 * band runs dry. Each particle enters after its delay and loops at its own
 * speed, while the halo rises to full over the band's fill. Once the
 * story's ending starts, nothing new enters: each particle in the band
 * finishes the trip it is on, one still waiting never enters, and the halo
 * settles back over the time the last trip takes. When both are done, the
 * band and the glow are back on the still frame and the story ends.
 */
function useBandFlow(
  band: readonly BandParticle[],
  halo: MotionValue<number>,
  stage: HeldStage,
  plays: number,
  onStoryEnd: () => void,
) {
  // The stage as the frame loop sees it, kept current without restarting
  // the loop.
  const stageRef = useRef(stage);

  useEffect(() => {
    stageRef.current = stage;
  });

  const playing = stage !== 'still';

  // One loop per play, keyed by the play's count, so a play that follows
  // straight on from another's ending starts the band from empty again.
  useEffect(() => {
    if (!playing) return undefined;

    let seconds = 0;
    // Set once the ending starts: where each particle stops, in trips, and
    // how the halo settles from where it was.
    let ending:
      | { stops: number[]; startSeconds: number; fromHalo: number; settleSeconds: number }
      | undefined;
    const advance = ({ delta }: { delta: number }) => {
      seconds += delta / 1000;

      const runs = band.map(({ particle }) =>
        Math.max(0, particle.speed * (seconds - particle.delay)),
      );

      if (stageRef.current === 'ending' && !ending) {
        // Each stop comes from where its particle last showed, before this
        // frame's advance, so one whose delay ran out since then never enters.
        const stops = band.map(({ trips }) => {
          const shown = trips.get();

          return shown > 0 ? Math.floor(shown) + 1 : 0;
        });
        const drainSeconds = Math.max(
          0,
          ...band.map(
            ({ particle }, index) => ((stops[index] ?? 0) - (runs[index] ?? 0)) / particle.speed,
          ),
        );

        ending = {
          stops,
          startSeconds: seconds,
          fromHalo: halo.get(),
          settleSeconds: Math.max(drainSeconds, SHORTEST_SETTLE_SECONDS),
        };
      }

      // Whether any particle is still on the move, which only the ending's
      // stops can end.
      let moving = false;

      for (const [index, { trips }] of band.entries()) {
        const run = runs[index] ?? 0;
        const stop = ending?.stops[index] ?? Infinity;

        trips.set(Math.min(run, stop));
        if (run < stop) moving = true;
      }

      if (!ending) {
        halo.set(
          STILL_FRAME_HALO + (1 - STILL_FRAME_HALO) * easeOut(Math.min(1, seconds / FILL_SECONDS)),
        );

        return;
      }

      const settled = Math.min(1, (seconds - ending.startSeconds) / ending.settleSeconds);

      halo.set(ending.fromHalo + (STILL_FRAME_HALO - ending.fromHalo) * easeOut(settled));

      if (!moving && settled === 1) {
        cancelFrame(advance);
        onStoryEnd();
      }
    };

    frame.update(advance, true);

    return () => {
      cancelFrame(advance);
      band.forEach(({ trips }) => trips.set(0));
      halo.set(STILL_FRAME_HALO);
    };
  }, [playing, plays, band, halo, onStoryEnd]);
}

// ---------------------------------------------
// The illustration
// ---------------------------------------------

// Hidden from screen readers: the card's title and description carry its
// message. `data-band` marks the band of work, for the Playwright spec.
//
// `m` under LazyMotion rather than `motion`, as in the Extensible card: the
// particles and the chip only bind motion values to style, which domMin
// covers.
export function PerformantIllustration() {
  const { stage, plays, onStoryEnd } = useHeldStory();
  // How many trips each particle has run this play. At 0 it waits at its
  // entry end, out of sight, which is where every particle sits on the
  // still frame.
  const [band] = useState<readonly BandParticle[]>(() =>
    PARTICLES.map((particle) => ({ particle, trips: motionValue(0) })),
  );
  const halo = useMotionValue(STILL_FRAME_HALO);

  useBandFlow(band, halo, stage, plays, onStoryEnd);

  return (
    <div aria-hidden className={styles.illustration}>
      <LazyMotion features={domMin} strict>
        <div className={styles.band} data-band>
          {band.map(({ particle, trips }) => (
            <WorkParticle key={particle.id} particle={particle} trips={trips} />
          ))}
        </div>
        <Chip halo={halo} />
      </LazyMotion>
    </div>
  );
}

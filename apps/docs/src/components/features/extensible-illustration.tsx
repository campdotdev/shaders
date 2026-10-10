'use client';

/**
 * The Extensible feature card's illustration, after the Figma mock: a code
 * window headed `<shaders>`, with colored bars standing in for code. Its story
 * (SHA-214) steps the code up a line at a time and types each new line in,
 * until the window lands back on its still frame. story.tsx says when it plays.
 */
import type { CSSProperties } from 'react';

import { domMin, type Easing, LazyMotion, m, type Variants } from 'motion/react';

import { EASE_OUT } from '@/lib/easing';

import styles from './extensible-illustration.module.css';
import { useStory } from './story';

// ---------------------------------------------
// The code
// ---------------------------------------------

// The mock's bar colors, standing in for syntax highlighting.
const MAGENTA = '#cf4ef7';
const VIOLET = '#5e00c7';
const PINK = '#fd73d5';
const GRAY = 'var(--white-a30)';

/** A bar standing in for a word of code. */
interface Bar {
  /** In mock pixels. */
  width: number;
  color: string;
}

interface CodeLine {
  /** The side the line's bars sit against. A line set to the end reads as indented code. */
  align: 'start' | 'end';
  /** The line's bars, left to right. */
  bars: readonly Bar[];
}

// The mock's first seven lines. The code repeats every seven lines, so the
// story can scroll seven lines and land back on the still frame.
const CODE: readonly CodeLine[] = [
  {
    align: 'end',
    bars: [
      { width: 111, color: MAGENTA },
      { width: 41, color: VIOLET },
    ],
  },
  {
    align: 'start',
    bars: [
      { width: 49, color: PINK },
      { width: 120, color: GRAY },
    ],
  },
  { align: 'end', bars: [{ width: 139, color: MAGENTA }] },
  {
    align: 'start',
    bars: [
      { width: 21, color: VIOLET },
      { width: 102, color: GRAY },
    ],
  },
  {
    align: 'end',
    bars: [
      { width: 124, color: MAGENTA },
      { width: 39, color: VIOLET },
    ],
  },
  {
    align: 'start',
    bars: [
      { width: 32, color: VIOLET },
      { width: 88, color: GRAY },
      { width: 42, color: PINK },
    ],
  },
  {
    align: 'end',
    bars: [
      { width: 47, color: VIOLET },
      { width: 58, color: GRAY },
    ],
  },
];

// How many lines the window shows. The still frame writes all ten, the
// last one faint under the fade, as the mock draws it.
const WINDOW_LINES = 10;

// The first line the story types, counting from 0: the still frame's faint
// tenth. The story types each line in the ninth slot, where the fade has
// barely begun, so a play starts with that tenth line blank, and the first
// step lifts it into the ninth slot to type.
const FIRST_STORY_LINE = 9;

// Every line the story passes through, top to bottom: the still frame's
// first nine, then the seven the story types, starting with the still
// frame's tenth. The still frame's last three repeat its first three, where
// the mock drew lines of its own. They sit at the bottom, by the fade, which
// keeps the repeat from showing. After seven lines of scrolling, the window
// shows lines 8 to 16, which are the still frame's first nine again.
const LINES = [...CODE, ...CODE, ...CODE.slice(0, FIRST_STORY_LINE - CODE.length)];

// The lines the story types.
const STORY_LINES = LINES.slice(FIRST_STORY_LINE);

// A bar's width and color, which extensible-illustration.module.css reads.
type BarStyle = CSSProperties & { '--bar-width': number; '--bar-color': string };

function barStyle({ width, color }: Bar): BarStyle {
  return { '--bar-width': width, '--bar-color': color };
}

// ---------------------------------------------
// The story's timing
// ---------------------------------------------

// From the motion brief on SHA-214. The code steps up one line, then the
// line that rose into the ninth slot grows in: its bars grow up from their
// baseline, one after another, left to right, the way someone types a line.
// After seven lines the window shows the still frame again, where the next
// play picks up without a seam if the pointer is still on the card. Every
// curve is the site's --ease-out (lib/easing.ts): fast off the mark, with a
// long settle. Durations are in seconds, as Motion takes them.

// How long the code takes to step up one line. Longer makes each step glide
// rather than tick.
const STEP_SECONDS = 0.15;

// How long from the start of one step to the start of the next. Longer
// slows the whole story. It leaves room for the step and most of a line's
// typing, and a line's last bar may still be growing as the next step
// starts.
const LINE_SECONDS = 0.28;

// How long a bar takes to grow to its full height. Longer makes a bar swell
// into place rather than pop.
const GROW_SECONDS = 0.12;

// How far behind the bar to its left each bar starts to grow. Longer reads
// as slower typing.
const BAR_STAGGER_SECONDS = 0.04;

/**
 * When a story line's bar starts to grow: after its line's step lands, and
 * a stagger behind the bar to its left. `storyLine` counts the story's lines
 * from 0.
 */
function growDelay(storyLine: number, bar: number): number {
  return storyLine * LINE_SECONDS + STEP_SECONDS + bar * BAR_STAGGER_SECONDS;
}

// The whole story, from the first step to the last bar's full height. It has
// to stay under the 2-second ceiling SHA-178 sets for every feature card's
// story, so check it after any change to the timing above.
const STORY_SECONDS = Math.max(
  ...STORY_LINES.map(
    (line, storyLine) => growDelay(storyLine, line.bars.length - 1) + GROW_SECONDS,
  ),
);

// ---------------------------------------------
// The story's motion
// ---------------------------------------------

// One line's share of the lines' column, in percent. A `y` in percent moves
// the column by a share of its own height, so a step is one line at every
// card width.
const LINE_PERCENT = 100 / LINES.length;

/**
 * The column's scroll across the whole story, as one keyframed animation:
 * for each story line, hold where the last step left the column, then step
 * up one line. It then holds on the still frame until the last bar has
 * grown, so the column's animation ends when the story does.
 */
function scrollAnimation() {
  const keyframes = STORY_LINES.flatMap((_, storyLine) => [
    { line: storyLine, seconds: storyLine * LINE_SECONDS },
    { line: storyLine + 1, seconds: storyLine * LINE_SECONDS + STEP_SECONDS },
  ]);

  keyframes.push({ line: STORY_LINES.length, seconds: STORY_SECONDS });

  // Each segment between two keyframes is either a step, which eases out, or
  // a hold, which has nothing to ease.
  const ease: Easing[] = keyframes
    .slice(1)
    .map(({ line }, index) => (line === keyframes[index]?.line ? 'linear' : EASE_OUT));

  return {
    y: keyframes.map(({ line }) => `${-line * LINE_PERCENT}%`),
    transition: {
      duration: STORY_SECONDS,
      times: keyframes.map(({ seconds }) => seconds / STORY_SECONDS),
      ease,
    },
  };
}

// Every play, and the end of the story, mounts a fresh column (see the
// illustration below), so nothing ever animates back to `still` or `start`:
// a column starts at one of them. `still` is the still frame. `start` is
// where a play begins: the still frame with the lines the story types blank,
// which leaves the tenth slot empty.
const COLUMN_VARIANTS: Variants = {
  still: { y: '0%' },
  start: { y: '0%' },
  story: scrollAnimation(),
};

/** What a story line's bar needs from Motion's `custom`. */
interface StoryBar {
  /** Whether the still frame shows the bar: true for the faint tenth line. */
  inStillFrame: boolean;
  /** When the bar starts to grow in a play, from growDelay. */
  delay: number;
}

// A story line's bars sit flat on their baseline until the story types
// them, except the still frame's tenth line, whose bars are up at rest.
const BAR_VARIANTS: Variants = {
  still: ({ inStillFrame }: StoryBar) => ({ scaleY: inStillFrame ? 1 : 0 }),
  start: { scaleY: 0 },
  story: ({ delay }: StoryBar) => ({
    scaleY: 1,
    transition: { delay, duration: GROW_SECONDS, ease: EASE_OUT },
  }),
};

function storyBar(lineIndex: number, barIndex: number): StoryBar {
  return {
    inStillFrame: lineIndex < WINDOW_LINES,
    delay: growDelay(lineIndex - FIRST_STORY_LINE, barIndex),
  };
}

// ---------------------------------------------
// The illustration
// ---------------------------------------------

// Hidden from screen readers: the card's title and description carry its
// message. `data-lines` marks the column the story scrolls, for the
// Playwright spec. The lines never reorder, so their places serve as keys.
//
// Each play mounts a fresh column at `start`, keyed by the play's count, and
// the end of the story mounts one at `still`, keyed `still`. A finished
// play's column shows the still frame's first nine lines, because its last
// seven lines repeat the seven above them, over an empty tenth slot. So the
// swap to the next play's `start` shows no seam. The swap at either end of
// the story only blanks or restores the faint tenth line, under the darkest
// part of the fade.
//
// `m` under LazyMotion rather than `motion`, as in the favorites' card tab:
// the column and the bars only animate to their variants, which domMin
// covers.
export function ExtensibleIllustration() {
  const { playing, plays, onStoryEnd } = useStory();

  return (
    <div aria-hidden className={styles.illustration}>
      <div className={styles.codeWindow}>
        <div className={styles.code}>
          <p className={styles.header}>{'<shaders>'}</p>
          <div className={styles.viewport}>
            <LazyMotion features={domMin} strict>
              <m.div
                animate={playing ? 'story' : 'still'}
                className={styles.column}
                data-lines
                initial={playing ? 'start' : 'still'}
                key={playing ? plays : 'still'}
                onAnimationComplete={(definition) => {
                  if (definition === 'story') onStoryEnd();
                }}
                variants={COLUMN_VARIANTS}
              >
                {LINES.map((line, lineIndex) => (
                  <div className={styles.line} data-align={line.align} key={lineIndex}>
                    {line.bars.map((bar, barIndex) =>
                      lineIndex < FIRST_STORY_LINE ? (
                        <span className={styles.bar} key={barIndex} style={barStyle(bar)} />
                      ) : (
                        <m.span
                          className={styles.bar}
                          custom={storyBar(lineIndex, barIndex)}
                          key={barIndex}
                          style={barStyle(bar)}
                          variants={BAR_VARIANTS}
                        />
                      ),
                    )}
                  </div>
                ))}
              </m.div>
            </LazyMotion>
          </div>
        </div>
      </div>
    </div>
  );
}

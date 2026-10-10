/**
 * The Extensible feature card's illustration, after the Figma mock: a code
 * window headed `<shaders>`, with ten lines of colored bars standing in for
 * code and a fade over its bottom edge. It is built in the DOM rather than
 * exported as an image so its story can move the lines (SHA-214). This file
 * draws the still frame, which features.tsx shows in the card's window.
 */
import type { CSSProperties } from 'react';

import styles from './extensible-illustration.module.css';

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

// The ten lines the window shows at rest. The last three repeat the first
// three, where the mock drew three lines of its own. They sit at the bottom,
// mostly under the fade, which keeps the repeat from showing.
const STILL_FRAME_LINES = [...CODE, ...CODE.slice(0, 3)];

// A bar's width and color, which extensible-illustration.module.css reads.
type BarStyle = CSSProperties & { '--bar-width': number; '--bar-color': string };

function barStyle({ width, color }: Bar): BarStyle {
  return { '--bar-width': width, '--bar-color': color };
}

// ---------------------------------------------
// The illustration
// ---------------------------------------------

// Hidden from screen readers: the card's title and description carry its
// message. The lines never reorder, so their places serve as keys.
export function ExtensibleIllustration() {
  return (
    <div aria-hidden className={styles.illustration}>
      <div className={styles.codeWindow}>
        <div className={styles.code}>
          <p className={styles.header}>{'<shaders>'}</p>
          <div className={styles.lines}>
            {STILL_FRAME_LINES.map((line, lineIndex) => (
              <div className={styles.line} data-align={line.align} key={lineIndex}>
                {line.bars.map((bar, barIndex) => (
                  <span className={styles.bar} key={barIndex} style={barStyle(bar)} />
                ))}
              </div>
            ))}
          </div>
          <div className={styles.fade} />
        </div>
      </div>
    </div>
  );
}

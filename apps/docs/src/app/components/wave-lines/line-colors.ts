/**
 * WaveLines' line colors for a composition's All props section. A line's
 * color can be one string, a list of stops, or left out, and the Colors list
 * edits only a list, so the store needs every line's color as one.
 */
import { isRecord } from '@/compositions/store';

// The color shader.tsx draws a line in when its color is left out. The
// package doesn't export it.
const OMITTED_LINE_COLOR = '#ff6f6a';

/** Turns each line's single or omitted color into the one-stop list the component draws the same. */
export function seedLineColors(props: Record<string, unknown>): Record<string, unknown> {
  const { lines } = props;

  if (!Array.isArray(lines)) return props;

  return {
    ...props,
    lines: lines.map((line: unknown) => {
      if (!isRecord(line) || Array.isArray(line.color)) return line;

      return {
        ...line,
        color: [typeof line.color === 'string' ? line.color : OMITTED_LINE_COLOR],
      };
    }),
  };
}

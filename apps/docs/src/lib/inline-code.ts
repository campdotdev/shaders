/**
 * Splits prose that uses Markdown backticks for code spans into segments, so
 * a component can render the spans as <code>. The props table's descriptions
 * come straight from registry JSDoc, which writes `oklch()` and `center` in
 * backticks.
 */

export interface InlineSegment {
  code: boolean;
  text: string;
}

const CODE_SPAN = /`([^`]+)`/g;

export function splitInlineCode(text: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  let cursor = 0;

  for (const match of text.matchAll(CODE_SPAN)) {
    if (match.index > cursor) {
      segments.push({ code: false, text: text.slice(cursor, match.index) });
    }

    segments.push({ code: true, text: match[1] ?? '' });
    cursor = match.index + match[0].length;
  }

  if (cursor < text.length || segments.length === 0) {
    segments.push({ code: false, text: text.slice(cursor) });
  }

  return segments;
}

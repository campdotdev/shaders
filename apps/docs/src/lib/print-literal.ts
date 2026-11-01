/**
 * How a literal prop value prints in copied code. The page header's Copy
 * React (components/controls/copy.ts) and the composition generator
 * (compositions/generate.ts) share these, so both escape strings alike.
 */

// Sliders produce float noise such as 0.30000000000000004. Four places is
// finer than any control's step.
const DECIMAL_PLACES = 4;

export const roundNumber = (value: number) =>
  Math.round(value * 10 ** DECIMAL_PLACES) / 10 ** DECIMAL_PLACES;

// Single quotes, as the repo's Prettier config asks, unless the string holds
// more single quotes than double ones, where Prettier switches. A line break
// can't sit inside a quoted string, so it prints as its escape.
export function printString(value: string): string {
  const singles = value.split("'").length - 1;
  const doubles = value.split('"').length - 1;
  const quote = singles > doubles ? '"' : "'";
  const escaped = value
    .replaceAll('\\', '\\\\')
    .replaceAll('\n', '\\n')
    .replaceAll('\r', '\\r')
    .replaceAll(' ', '\\u2028')
    .replaceAll(' ', '\\u2029')
    .replaceAll(quote, `\\${quote}`);

  return `${quote}${escaped}${quote}`;
}

/**
 * Prints JSX elements and their literal props in the repo's Prettier style,
 * without running Prettier. The composition generator (compositions/generate.ts)
 * prints a copied file's stack through it, and the page header's Copy React
 * (components/controls/copy.ts) prints a component page's demo through it,
 * so both copy the same prop value in the same shape.
 */
import { isRecord } from './is-record';
import { printString, roundNumber } from './print-literal';

// Prettier's printWidth in the repo's .prettierrc.
const PRINT_WIDTH = 100;

export const INDENT = '  ';

// ----------------------------------------------------------------------------
// Elements
// ----------------------------------------------------------------------------
// Prettier keeps a JSX element on one line when it fits and no value in it
// forces a break. Otherwise every attribute takes its own line, and each
// attribute's value then gets the same choice at its own indent.

/** A self-closing element at `indent`, such as `<Grain intensity={0.08} />`. */
export function printElement(
  name: string,
  props: ReadonlyArray<readonly [string, unknown]>,
  indent: string,
): string {
  if (props.length === 0) return `${indent}<${name} />`;

  const flat = `${indent}<${name} ${props.map(([key, value]) => printAttribute(key, value)).join(' ')} />`;

  if (fits(flat) && !props.some(([, value]) => holdsForcedBreak(value))) return flat;

  const attributeIndent = indent + INDENT;

  return [
    `${indent}<${name}`,
    ...props.map(([key, value]) => printAttribute(key, value, attributeIndent)),
    `${indent}/>`,
  ].join('\n');
}

/** An opening tag at `indent` around attributes already printed, such as `{...props}`. */
export function printOpeningTag(
  name: string,
  attributes: readonly string[],
  indent: string,
): string {
  const flat = `${indent}<${name} ${attributes.join(' ')}>`;

  if (fits(flat)) return flat;

  return [
    `${indent}<${name}`,
    ...attributes.map((attribute) => `${indent}${INDENT}${attribute}`),
    `${indent}>`,
  ].join('\n');
}

/**
 * One attribute. Strings print as JSX strings and everything else in braces.
 * With an indent, the attribute starts its own line, and its value breaks
 * when that line would pass the print width. Without one, it prints flat for
 * a one-line element.
 */
export function printAttribute(name: string, value: unknown, indent?: string): string {
  if (typeof value === 'string' && !value.includes('"')) return `${indent ?? ''}${name}="${value}"`;

  if (indent === undefined) return `${name}={${printFlat(value)}}`;

  return `${indent}${name}={${printValue(value, indent, `${name}={`.length, '}'.length)}}`;
}

// ----------------------------------------------------------------------------
// Values
// ----------------------------------------------------------------------------

/**
 * A value at a line's `indent`, after `before` characters and ahead of
 * `after` characters on the same line. It prints flat when the whole line
 * fits, and breaks otherwise.
 */
function printValue(value: unknown, indent: string, before: number, after: number): string {
  const flat = printFlat(value);

  if (!holdsForcedBreak(value) && indent.length + before + flat.length + after <= PRINT_WIDTH)
    return flat;
  if (Array.isArray(value)) return printBrokenArray(value, indent);
  if (isRecord(value)) return printBrokenObject(value, indent);

  return flat;
}

function printBrokenArray(items: readonly unknown[], indent: string): string {
  const inner = indent + INDENT;

  // Prettier fills an array of plain numbers, packing as many per line as fit.
  if (items.length > 0 && items.every((item) => typeof item === 'number')) {
    const lines: string[] = [];
    let line = '';

    for (const item of items) {
      const next = `${printFlat(item)},`;

      if (line !== '' && inner.length + line.length + 1 + next.length > PRINT_WIDTH) {
        lines.push(line);
        line = next;
      } else {
        line = line === '' ? next : `${line} ${next}`;
      }
    }

    lines.push(line);

    return `[\n${lines.map((text) => inner + text).join('\n')}\n${indent}]`;
  }

  const lines = items.map((item) => `${inner}${printValue(item, inner, 0, ','.length)},`);

  return `[\n${lines.join('\n')}\n${indent}]`;
}

function printBrokenObject(record: Readonly<Record<string, unknown>>, indent: string): string {
  const inner = indent + INDENT;
  const lines = Object.entries(record)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => {
      const printedKey = printKey(key);

      return `${inner}${printedKey}: ${printValue(value, inner, printedKey.length + 2, ','.length)},`;
    });

  return `{\n${lines.join('\n')}\n${indent}}`;
}

/**
 * Prettier always breaks an array of two or more arrays, or of two or more
 * objects, when each of them holds more than one item. MeshGradient's two
 * palettes are the case in point. The break also breaks every object, array,
 * and element around it, so a value holding one anywhere inside breaks too.
 */
function holdsForcedBreak(value: unknown): boolean {
  if (Array.isArray(value)) return forcesBreak(value) || value.some(holdsForcedBreak);
  if (isRecord(value)) return Object.values(value).some(holdsForcedBreak);

  return false;
}

function forcesBreak(items: readonly unknown[]): boolean {
  if (items.length < 2) return false;

  const allArrays = items.every((item) => Array.isArray(item) && item.length > 1);
  const allObjects = items.every((item) => isRecord(item) && Object.keys(item).length > 1);

  return allArrays || allObjects;
}

function printFlat(value: unknown): string {
  if (typeof value === 'number') return String(roundNumber(value));
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'string') return printString(value);
  if (Array.isArray(value)) return `[${value.map(printFlat).join(', ')}]`;

  if (isRecord(value)) {
    const entries = Object.entries(value)
      .filter(([, entryValue]) => entryValue !== undefined)
      .map(([key, entryValue]) => `${printKey(key)}: ${printFlat(entryValue)}`);

    return entries.length === 0 ? '{}' : `{ ${entries.join(', ')} }`;
  }

  throw new Error(`A copied prop can only hold literals, not ${String(value)}`);
}

const printKey = (key: string) => (/^[A-Za-z_$][\w$]*$/.test(key) ? key : printString(key));

/** Whether a line fits in Prettier's print width. */
export const fits = (line: string) => line.length <= PRINT_WIDTH;

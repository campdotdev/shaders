/**
 * Turns a composition and its Customize panel's state into the component
 * file Copy React hands out, already in the repo's Prettier style. Pure and
 * three-free, so golden.test.ts commits its output for every preset, and its
 * own tests hold its line breaking to Prettier's. Grew out of controls/copy.ts.
 */
import type { Composition, EntryProps, StackEntry } from './define';
import {
  type CompositionDefaults,
  type CompositionState,
  type CompositionStore,
  isRecord,
  type SeedFields,
  withStopPositions,
} from './store';

/** What the generator reads from the panel: the loaded preset and the props as they stand. */
export interface GenerateInput {
  composition: Composition;
  /** The picker's loaded preset. Its props print even where they match a library default. */
  preset: string;
  /** Each entry's props, keyed by entry id, as the panel's store holds them. */
  state: CompositionState;
  /** The library defaults for each entry's component, keyed by entry id. */
  defaults: CompositionDefaults;
  /**
   * What the panel's store runs on each entry's props when it loads them.
   * The file runs it too, so a prop prints only where it differs from what
   * the component renders without it. Defaults to leaving props as they are.
   */
  seed?: SeedFields;
}

// Prettier's printWidth in the repo's .prettierrc.
const PRINT_WIDTH = 100;
const INDENT = '  ';

// Sliders produce float noise such as 0.30000000000000004. Four places is
// finer than any control's step.
const DECIMAL_PLACES = 4;

// ----------------------------------------------------------------------------
// The file
// ----------------------------------------------------------------------------

export function generateComposition({
  composition,
  preset,
  state,
  defaults,
  seed = (_entry, props) => props,
}: GenerateInput): string {
  const presetOverride = composition.presets.find(({ name }) => name === preset)?.props;
  const componentNames = [...new Set(composition.stack.map(({ component }) => component))];
  const sceneAttributes = Object.entries(composition.scene ?? {})
    .filter(([, value]) => value !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : 1));

  // The stack sits two levels inside the function: under `return (` and
  // then under <ShaderScene>.
  const elementIndent = INDENT.repeat(3);
  const elements = composition.stack.map((entry) => {
    const props: EntryProps = state[entry.id] ?? entry.props;
    const setBy = { ...entry.props, ...presetOverride?.[entry.id] };
    // The defaults in the shape the store holds, so stops the library spaces
    // evenly compare equal to the positions the store wrote out for them.
    const entryDefaults = withStopPositions(entry.component, defaults[entry.id] ?? {});
    const baseline = renderedWithout(entry, props, entryDefaults, seed);
    // Sorted, as the repo's jsx-sort-props rule sorts hand-written JSX.
    const printed = Object.keys(props)
      .filter((name) => shouldPrint(name, props, setBy, baseline))
      .sort();

    return printElement(
      entry.component,
      printed.map((name) => [name, props[name]] as const),
      elementIndent,
    );
  });

  return [
    "'use client';",
    '',
    printImport([...componentNames, 'ShaderScene', 'type ShaderSceneProps']),
    '',
    `export function ${pascalCase(composition.title)}(props: Omit<ShaderSceneProps, 'children'>) {`,
    `${INDENT}return (`,
    printOpeningTag(
      'ShaderScene',
      [...sceneAttributes.map(([name, value]) => printAttribute(name, value)), '{...props}'],
      INDENT.repeat(2),
    ),
    ...elements,
    `${INDENT.repeat(2)}</ShaderScene>`,
    `${INDENT});`,
    '}',
    '',
  ].join('\n');
}

/** The file for the panel as it stands: its loaded preset and its current props. */
export function generateFromStore(
  composition: Composition,
  defaults: CompositionDefaults,
  store: CompositionStore,
): string {
  return generateComposition({
    composition,
    preset: store.getPreset(),
    state: store.getSnapshot(),
    defaults,
    seed: store.seed,
  });
}

/**
 * What the component renders for each prop the file leaves out. A prop with
 * a library default gets that default, seeded into the shape the store holds,
 * so FlutedGlass's `'round'` reads as its dial value. A prop with none, such
 * as FractalNoise's contrast, gets what the seed picks for the props that
 * have one, so a contrast that matches the old style prints once the style
 * changes.
 */
function renderedWithout(
  entry: StackEntry,
  props: EntryProps,
  defaults: EntryProps,
  seed: SeedFields,
): EntryProps {
  const defaulted = Object.keys(defaults);
  const seededDefaults = seed(entry, { ...defaults });
  const current = Object.fromEntries(
    defaulted.filter((name) => name in props).map((name) => [name, props[name]]),
  );

  return {
    ...seed(entry, current),
    ...Object.fromEntries(defaulted.map((name) => [name, seededDefaults[name]])),
  };
}

/**
 * Whether a prop belongs in the file: the document or the loaded preset sets
 * it, or its value differs from what the component renders without it.
 */
function shouldPrint(
  name: string,
  props: EntryProps,
  setBy: EntryProps,
  baseline: EntryProps,
): boolean {
  if (props[name] === undefined) return false;
  if (name in setBy) return true;

  return !sameValue(props[name], baseline[name]);
}

function sameValue(a: unknown, b: unknown): boolean {
  if (typeof a === 'number' && typeof b === 'number') return roundNumber(a) === roundNumber(b);
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => sameValue(item, b[index]));
  }

  if (isRecord(a) && isRecord(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);

    return [...keys].every((key) => sameValue(a[key], b[key]));
  }

  return a === b;
}

/** "Fixture" → Fixture, "Late summer haze" → LateSummerHaze. */
export function pascalCase(title: string): string {
  return title
    .split(/[^A-Za-z0-9]+/)
    .filter((word) => word.length > 0)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

/** The file name a preset's golden file takes: "Late Summer" → late-summer. */
export function kebabCase(name: string): string {
  return name
    .split(/[^A-Za-z0-9]+/)
    .filter((word) => word.length > 0)
    .map((word) => word.toLowerCase())
    .join('-');
}

// ----------------------------------------------------------------------------
// The import line
// ----------------------------------------------------------------------------
// The repo's import-sorting Prettier plugin orders specifiers
// case-insensitively, ignoring `type`, and Prettier breaks the braces one
// specifier per line once the line passes the print width.

function printImport(specifiers: readonly string[]): string {
  const sorted = [...specifiers].sort((a, b) =>
    stripType(a).toLowerCase().localeCompare(stripType(b).toLowerCase()),
  );
  const flat = `import { ${sorted.join(', ')} } from '@camp-dev/shaders';`;

  if (flat.length <= PRINT_WIDTH) return flat;

  return [
    'import {',
    ...sorted.map((name) => `${INDENT}${name},`),
    "} from '@camp-dev/shaders';",
  ].join('\n');
}

const stripType = (specifier: string) => specifier.replace(/^type /, '');

// ----------------------------------------------------------------------------
// Elements
// ----------------------------------------------------------------------------
// Prettier keeps a JSX element on one line when it fits. Otherwise every
// attribute takes its own line, and each attribute's value then gets the
// same choice at its own indent.

function printElement(
  name: string,
  props: ReadonlyArray<readonly [string, unknown]>,
  indent: string,
): string {
  if (props.length === 0) return `${indent}<${name} />`;

  const flat = `${indent}<${name} ${props.map(([key, value]) => printAttribute(key, value)).join(' ')} />`;

  if (fits(flat)) return flat;

  const attributeIndent = indent + INDENT;

  return [
    `${indent}<${name}`,
    ...props.map(([key, value]) => printAttribute(key, value, attributeIndent)),
    `${indent}/>`,
  ].join('\n');
}

function printOpeningTag(name: string, attributes: readonly string[], indent: string): string {
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
function printAttribute(name: string, value: unknown, indent?: string): string {
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

  if (!mustBreak(value) && indent.length + before + flat.length + after <= PRINT_WIDTH) return flat;
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
 * palettes are the case in point.
 */
function mustBreak(value: unknown): boolean {
  if (!Array.isArray(value) || value.length < 2) return false;

  const allArrays = value.every((item) => Array.isArray(item) && item.length > 1);
  const allObjects = value.every((item) => isRecord(item) && Object.keys(item).length > 1);

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

  throw new Error(`A composition prop can only hold literals, not ${String(value)}`);
}

// Single quotes, as the repo's Prettier config asks, unless the string holds
// more single quotes than double ones, where Prettier switches. A line break
// can't sit inside a quoted string, so it prints as its escape.
function printString(value: string): string {
  const singles = value.split("'").length - 1;
  const doubles = value.split('"').length - 1;
  const quote = singles > doubles ? '"' : "'";
  const escaped = value
    .replaceAll('\\', '\\\\')
    .replaceAll('\n', '\\n')
    .replaceAll('\r', '\\r')
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029')
    .replaceAll(quote, `\\${quote}`);

  return `${quote}${escaped}${quote}`;
}

const printKey = (key: string) => (/^[A-Za-z_$][\w$]*$/.test(key) ? key : printString(key));

const roundNumber = (value: number) =>
  Math.round(value * 10 ** DECIMAL_PLACES) / 10 ** DECIMAL_PLACES;

const fits = (line: string) => line.length <= PRINT_WIDTH;

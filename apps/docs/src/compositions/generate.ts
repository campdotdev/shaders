/**
 * Turns a composition and its Customize panel's state into the component
 * file Copy React hands out, already in the repo's Prettier style. Pure and
 * three-free, so golden.test.ts commits its output for every preset, and its
 * own tests hold its line breaking to Prettier's. The elements print through
 * lib/print-jsx.ts, which the component pages' Copy React shares.
 */
import { isRecord } from '@/lib/is-record';
import { fits, INDENT, printAttribute, printElement, printOpeningTag } from '@/lib/print-jsx';
import { roundNumber } from '@/lib/print-literal';

import type { Composition, EntryProps, StackEntry } from './define';
import {
  type CompositionDefaults,
  type CompositionState,
  type CompositionStore,
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
  const exportedName = exportName(composition.title, [
    ...componentNames,
    'ShaderScene',
    'ShaderSceneProps',
  ]);
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
    `export function ${exportedName}(props: Omit<ShaderSceneProps, 'children'>) {`,
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

/**
 * The copied component's name: the title in PascalCase, with `Composition`
 * after it when that would repeat a name the file imports, such as a
 * "Mesh Gradient" title over a MeshGradient entry.
 */
function exportName(title: string, imported: readonly string[]): string {
  const name = pascalCase(title);

  return imported.includes(name) ? `${name}Composition` : name;
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

  if (fits(flat)) return flat;

  return [
    'import {',
    ...sorted.map((name) => `${INDENT}${name},`),
    "} from '@camp-dev/shaders';",
  ].join('\n');
}

const stripType = (specifier: string) => specifier.replace(/^type /, '');

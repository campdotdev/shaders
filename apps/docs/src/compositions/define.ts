/**
 * The composition document, as ADR 0005 lays it out: a named stack of public
 * Sources and Effects with set props, which each `<slug>/composition.ts`
 * passes to defineComposition. The types make a wrong name, prop, value, or
 * control path fail to compile, and nothing here reaches three at runtime.
 */
import type { ComponentProps } from 'react';

import type { AnimatableSignal } from '@camp-dev/shaders';

import type { COMPONENT_MAP } from './component-map';

type ComponentMap = typeof COMPONENT_MAP;

/** A public Source or Effect, by its export name, such as `'MeshGradient'`. */
export type ComponentName = keyof ComponentMap;

// ----------------------------------------------------------------------------
// Literal props
// ----------------------------------------------------------------------------

/**
 * A prop type cut down to what a document can write as a literal: numbers,
 * strings, booleans, and arrays or plain objects of those. A callback or an
 * animation signal becomes `never`, so `AnimatableProp<number>` keeps only its
 * `number` half and a callback prop drops out of LiteralProps entirely. The
 * `'cursor'` shorthand on a position prop is a string, so it stays. Arrays
 * come out readonly, because `defineComposition` infers its stack as `const`,
 * and a readonly literal array is not assignable to a mutable one.
 */
type LiteralOf<T> = T extends (...args: never[]) => unknown
  ? never
  : T extends AnimatableSignal<unknown>
    ? never
    : T extends readonly unknown[]
      ? { readonly [K in keyof T]: LiteralOf<T[K]> }
      : T extends object
        ? { readonly [K in keyof T]: LiteralOf<T[K]> }
        : T;

/** A props type with each prop cut to its literal half, and callback props dropped. */
export type LiteralPropsOf<Props> = {
  readonly [K in keyof Props as [LiteralOf<NonNullable<Props[K]>>] extends [never]
    ? never
    : K]?: LiteralOf<NonNullable<Props[K]>>;
};

/** Every prop of a component that a document can set, each one optional. */
export type LiteralProps<N extends ComponentName> = LiteralPropsOf<ComponentProps<ComponentMap[N]>>;

// ----------------------------------------------------------------------------
// The stack
// ----------------------------------------------------------------------------

/**
 * One Source or Effect in the stack. `id` names the entry for presets,
 * controls, and the store, and is unique in the composition. The copied
 * file never prints it. Never call an entry a layer: the glossary term for
 * the whole list is Stack.
 */
export type StackEntry = {
  [N in ComponentName]: {
    readonly id: string;
    readonly component: N;
    readonly props: LiteralProps<N>;
  };
}[ComponentName];

/**
 * The stack with every prop its component doesn't have typed as `never`.
 * The stack is inferred from the document itself, so ordinary excess-property
 * checking never runs on it, and a typo such as `sped` would otherwise pass.
 * CompositionDocument intersects the inferred stack with this, which puts the
 * error on the typo. NoInfer keeps this half out of inference, so the
 * stack's ids stay literal.
 */
type ExactStack<TStack extends readonly StackEntry[]> = {
  readonly [I in keyof TStack]: ExactEntry<TStack[I]>;
};

type ExactEntry<Entry> = Entry extends StackEntry
  ? {
      readonly id: Entry['id'];
      readonly component: Entry['component'];
      readonly props: LiteralProps<Entry['component']> &
        Readonly<
          Record<Exclude<keyof Entry['props'], keyof LiteralProps<Entry['component']>>, never>
        >;
    }
  : Entry;

/** `<ShaderScene>` props the document sets. No control or preset can change them. */
export interface SceneProps {
  readonly scrollPush?: boolean;
  readonly maxFPS?: number;
}

// ----------------------------------------------------------------------------
// Presets
// ----------------------------------------------------------------------------

/**
 * A partial override per entry id. Loading a preset resets to the stack's
 * props and then applies the override, so a loaded preset is always
 * complete. A preset can't add, remove, or reorder entries.
 */
interface PresetOf<TStack extends readonly StackEntry[]> {
  readonly name: string;
  readonly props: {
    readonly [Entry in TStack[number] as Entry['id']]?: LiteralProps<Entry['component']>;
  };
}

// ----------------------------------------------------------------------------
// Control paths
// ----------------------------------------------------------------------------
// A control's `path` is dotted, such as 'palettes.0.2', and each segment walks
// one level into the entry's props. PathEntries lists every path a props
// type has as a union of [path, value] pairs, so a control kind can keep the
// paths whose value it can edit. Tuples list their own indices, and plain
// arrays accept any index through `${number}`. Four levels covers the
// deepest prop today, a WaveLines line's color list.

type MaxPathDepth = 4;

type PathEntries<T, Depth extends unknown[] = []> = Depth['length'] extends MaxPathDepth
  ? never
  : T extends readonly unknown[]
    ? number extends T['length']
      ? PathEntriesUnder<`${number}`, T[number], Depth>
      : { [K in keyof T & `${number}`]: PathEntriesUnder<K, T[K], Depth> }[keyof T & `${number}`]
    : T extends object
      ? { [K in keyof T & string]-?: PathEntriesUnder<K, NonNullable<T[K]>, Depth> }[keyof T &
          string]
      : never;

type PathEntriesUnder<Key extends string, Value, Depth extends unknown[]> =
  | [Key, Value]
  | (PathEntries<Value, [...Depth, unknown]> extends infer Sub
      ? Sub extends [infer SubPath extends string, infer SubValue]
        ? [`${Key}.${SubPath}`, SubValue]
        : never
      : never);

/** The paths into `Props` whose value is a `Value`. */
type PathsTo<Props, Value> = Extract<PathEntries<Props>, [string, Value]>[0];

/**
 * The paths into `Props` whose value is a union of string literals, which is
 * what a select can offer. A plain `string`, such as a color, has no options.
 */
type SelectPaths<Props> =
  PathEntries<Props> extends infer Entry
    ? Entry extends [infer Path, infer Value]
      ? [Extract<Value, string>] extends [never]
        ? never
        : string extends Extract<Value, string>
          ? never
          : Path
      : never
    : never;

type ValueAt<Props, Path> = Extract<PathEntries<Props>, [Path, unknown]>[1];

// ----------------------------------------------------------------------------
// Controls
// ----------------------------------------------------------------------------
// A control sets exactly one prop, the first segment of its path, which is
// the glossary's rule for a composition's controls.

interface ControlBase<Id extends string, Path extends string> {
  /** The stack entry the control edits, by id. */
  readonly entry: Id;
  /** A dotted path into that entry's props, such as `'speed'` or `'palettes.0.2'`. */
  readonly path: Path;
  readonly label: string;
}

interface RangeControl<Id extends string, Path extends string> extends ControlBase<Id, Path> {
  readonly min: number;
  readonly max: number;
  readonly step: number;
}

export interface SliderControl<
  Id extends string = string,
  Path extends string = string,
> extends RangeControl<Id, Path> {
  readonly kind: 'slider';
}

export interface NumberControl<
  Id extends string = string,
  Path extends string = string,
> extends RangeControl<Id, Path> {
  readonly kind: 'number';
}

export interface SelectControl<
  Id extends string = string,
  Path extends string = string,
  Value extends string = string,
> extends ControlBase<Id, Path> {
  readonly kind: 'select';
  readonly options: ReadonlyArray<{ readonly label: string; readonly value: Value }>;
}

export interface ColorControl<
  Id extends string = string,
  Path extends string = string,
> extends ControlBase<Id, Path> {
  readonly kind: 'color';
}

/** Any control, with its entry and path widened to strings, as the panel reads it. */
export type CompositionControl = SliderControl | NumberControl | SelectControl | ColorControl;

type SelectControlsOf<Id extends string, Props> = {
  [Path in SelectPaths<Props> & string]: SelectControl<
    Id,
    Path,
    Extract<ValueAt<Props, Path>, string>
  >;
}[SelectPaths<Props> & string];

type ControlsOfEntry<Id extends string, Props> =
  | SliderControl<Id, PathsTo<Props, number> & string>
  | NumberControl<Id, PathsTo<Props, number> & string>
  | ColorControl<Id, PathsTo<Props, string> & string>
  | SelectControlsOf<Id, Props>;

type ControlOf<TStack extends readonly StackEntry[]> = TStack[number] extends infer Entry
  ? Entry extends StackEntry
    ? ControlsOfEntry<Entry['id'], LiteralProps<Entry['component']>>
    : never
  : never;

// ----------------------------------------------------------------------------
// The document
// ----------------------------------------------------------------------------

interface CompositionMetadata {
  /** Sets the URL, `/gallery/<slug>`, and the file names. */
  readonly slug: string;
  /** The heading, the card label, and, in PascalCase, the copied component's name. */
  readonly title: string;
  /** One sentence for the card, the page lede, and the meta description. */
  readonly description: string;
}

/** What a composition file passes to defineComposition. */
interface CompositionDocument<TStack extends readonly StackEntry[]> extends CompositionMetadata {
  /** First entry at the bottom. Each Effect acts on what the entries before it drew. */
  readonly stack: TStack & NoInfer<ExactStack<TStack>>;
  readonly scene?: SceneProps;
  /** The picker lists "Default", the stack's own props, before these. */
  readonly presets: NoInfer<ReadonlyArray<PresetOf<TStack>>>;
  /** The curated controls, in panel order. */
  readonly controls: NoInfer<ReadonlyArray<ControlOf<TStack>>>;
}

/** One entry's props as the renderer, the store, and the generator read them. */
export type EntryProps = Readonly<Record<string, unknown>>;

/** A preset with its entry ids widened to strings. */
export interface CompositionPreset {
  readonly name: string;
  readonly props: Readonly<Record<string, EntryProps | undefined>>;
}

/**
 * A composition as everything downstream of its own file reads it: the
 * registry, the renderer, the panel, and the generator. Ids and paths are
 * plain strings here, because defineComposition has already checked them.
 */
export interface Composition extends CompositionMetadata {
  readonly stack: readonly StackEntry[];
  readonly scene?: SceneProps;
  readonly presets: readonly CompositionPreset[];
  readonly controls: readonly CompositionControl[];
}

/**
 * Checks a composition document against its components and returns it.
 * `const` keeps each entry's id as a literal, so presets and controls can be
 * checked against the ids the stack actually has.
 */
export function defineComposition<const TStack extends readonly StackEntry[]>(
  document: CompositionDocument<TStack>,
): Composition {
  return document;
}

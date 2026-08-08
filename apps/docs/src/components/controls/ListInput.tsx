'use client';

/**
 * A variable-length list of anything — gradient stops, palette colors, wave
 * lines. Rows wrap their children in a path prefix, so path="color" inside row
 * 2 lands on stops[2].color without knowing its index — and lets lists nest.
 * Subscribes to the array's length only: a nested write rebuilds the whole
 * array's identity, so reading the array itself here would re-render every row.
 */
import { createContext, type ReactNode, useContext } from 'react';

import { PathPrefixProvider, useControlStore } from './context';
import { normalizePath, type PathInput } from './store';
import { usePropValue, useResolvedPath, useSetProp } from './useControl';

/**
 * Ambient trail of ancestor row labels ("line 5") so a nested list's add/remove
 * buttons can name which parent row they belong to. Without this, every line's
 * Colors list produces buttons reading plain "Remove stop 1" -- identical text
 * repeated across all 8 lines, which a screen reader has no other way to tell apart.
 * Only rows contribute to this trail (never a list's own heading label) — a
 * nested list qualifies its buttons from the row it lives in ("line 5"), not
 * from its own heading ("Colors"), so the two don't double up into "stop 2
 * from Colors from line 5".
 */
const ListBreadcrumbContext = createContext<readonly string[]>([]);

export interface ListInputProps<TItem> {
  path: PathInput;
  /** Heading above the list, e.g. "Color stops". */
  label: string;
  /** Fewest items allowed. Remove is disabled at this count. */
  min: number;
  /** Most items allowed. Add is disabled at this count. */
  max: number;
  /** Builds the next item, given the current list. Usually clones the last one. */
  createItem: (items: readonly TItem[]) => TItem;
  /**
   * Where the new item lands, given the current list. Defaults to appending —
   * lists whose items must stay ordered (e.g. gradient stops with a closing
   * end stop) use this to insert mid-list instead.
   */
  insertIndex?: (items: readonly TItem[]) => number;
  /** Singular noun for row headings and button labels. Defaults to "item". */
  itemLabel?: string;
  children: (index: number) => ReactNode;
}

export function ListInput<TItem>({
  path,
  label,
  min,
  max,
  createItem,
  insertIndex,
  itemLabel = 'item',
  children,
}: ListInputProps<TItem>) {
  const store = useControlStore();
  const setProp = useSetProp();
  const resolvedPath = useResolvedPath(path);
  const segments = normalizePath(path);
  const ancestorBreadcrumb = useContext(ListBreadcrumbContext);

  // The only reactive read in this component. Writing any nested field (e.g.
  // stops[1].position) rebuilds every container from the root down to that
  // field, including this array, so subscribing to the array itself would
  // re-render every row on every drag anywhere in the list. The count is a
  // plain number, stable unless a row is actually added or removed.
  const count = usePropValue<number>([...segments, 'length']);

  // Reads the live array without subscribing to it -- used only inside click
  // handlers, where a stale-by-one-tick read would never happen anyway.
  const readItems = (): TItem[] =>
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- getAtPath returns unknown; TItem is the caller-supplied item shape for this list
    store.getAtPath(resolvedPath) as TItem[];

  const removeAt = (index: number) => {
    const items = readItems();

    setProp(
      path,
      items.filter((_unused, itemIndex) => itemIndex !== index),
    );
  };

  const add = () => {
    const items = readItems();
    const next = [...items];

    next.splice(insertIndex?.(items) ?? items.length, 0, createItem(items));
    setProp(path, next);
  };

  // What this list's own add/remove buttons name themselves after. A nested
  // list (inside another list's row) already has a row to point to -- "line
  // 5" -- and pointing to that instead of this list's own heading is what
  // keeps the wave-lines case reading "stop 2 from line 5" rather than
  // "stop 2 from Colors from line 5". A top-level list has no row, so it
  // falls back to its own heading -- otherwise sibling lists like mesh-
  // gradient's "Palette A" and "Palette B" would produce identical button
  // names ("Add color", "Remove color 1") with nothing to tell them apart.
  const qualifier = ancestorBreadcrumb.length > 0 ? ancestorBreadcrumb.join(' > ') : label;

  const addLabel = `Add ${itemLabel}`;
  const addAriaLabel = `${addLabel} to ${qualifier}`;

  // A fixed-size list (min === max, e.g. mesh-gradient's two 4-color
  // palettes) has no legal add/remove — rendering permanently-disabled
  // buttons would just be dead affordances, so skip them entirely.
  const fixedSize = min === max;

  return (
    <fieldset className="controls-section">
      <legend className="controls-list-header">
        <span className="controls-section-title">{label}</span>
        <span>{`${count} / ${max}`}</span>
      </legend>
      <ul className="controls-list">
        {/* Rows are positional, not identity-keyed: removing row 1 genuinely
            shifts row 2 into its place, and the path prefix follows the
            position. A stable per-item id would be dead weight here since
            nothing animates or preserves per-row UI state across a shift. */}
        {Array.from({ length: count }, (_unused, index) => {
          const ownLabel = `${itemLabel} ${index + 1}`;
          const removeLabel = `Remove ${ownLabel}`;
          const removeAriaLabel = `${removeLabel} from ${qualifier}`;

          return (
            <li className="controls-list-row" key={index}>
              <div className="controls-list-row-header">
                <span>{ownLabel}</span>
                {!fixedSize && (
                  <button
                    aria-label={removeAriaLabel}
                    className="controls-list-remove"
                    disabled={count <= min}
                    onClick={() => removeAt(index)}
                    type="button"
                  >
                    {removeLabel}
                  </button>
                )}
              </div>
              <PathPrefixProvider segments={[...segments, index]}>
                <ListBreadcrumbContext.Provider value={[...ancestorBreadcrumb, ownLabel]}>
                  {children(index)}
                </ListBreadcrumbContext.Provider>
              </PathPrefixProvider>
            </li>
          );
        })}
      </ul>
      {!fixedSize && (
        <button
          aria-label={addAriaLabel}
          className="controls-button"
          disabled={count >= max}
          onClick={add}
          type="button"
        >
          {addLabel}
        </button>
      )}
    </fieldset>
  );
}

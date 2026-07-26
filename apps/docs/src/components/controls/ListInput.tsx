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

    setProp(path, [...items, createItem(items)]);
  };

  // Undefined (no aria-label override) when this list has no ancestor row, so
  // a top-level list's buttons keep their existing accessible name -- only a
  // nested list needs the extra "from line 5" / "to line 5" qualifier.
  const addLabel = `Add ${itemLabel}`;
  const addAriaLabel =
    ancestorBreadcrumb.length > 0 ? `${addLabel} to ${ancestorBreadcrumb.join(' > ')}` : undefined;

  return (
    <div className="controls-section">
      <div className="controls-list-header">
        <span className="controls-section-title">{label}</span>
        <span>{`${count} / ${max}`}</span>
      </div>
      <ul className="controls-list">
        {/* Rows are positional, not identity-keyed: removing row 1 genuinely
            shifts row 2 into its place, and the path prefix follows the
            position. A stable per-item id would be dead weight here since
            nothing animates or preserves per-row UI state across a shift. */}
        {Array.from({ length: count }, (_unused, index) => {
          const ownLabel = `${itemLabel} ${index + 1}`;
          const removeLabel = `Remove ${ownLabel}`;
          const removeAriaLabel =
            ancestorBreadcrumb.length > 0
              ? `${removeLabel} from ${ancestorBreadcrumb.join(' > ')}`
              : undefined;

          return (
            <li className="controls-list-row" key={index}>
              <div className="controls-list-row-header">
                <span>{ownLabel}</span>
                <button
                  aria-label={removeAriaLabel}
                  className="controls-list-remove"
                  disabled={count <= min}
                  onClick={() => removeAt(index)}
                  type="button"
                >
                  {removeLabel}
                </button>
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
      <button
        aria-label={addAriaLabel}
        className="controls-button"
        disabled={count >= max}
        onClick={add}
        type="button"
      >
        {addLabel}
      </button>
    </div>
  );
}

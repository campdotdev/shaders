'use client';

/**
 * A variable-length list of anything — gradient stops, palette colors, wave
 * lines. Each row wraps its children in a path prefix, so a control inside it
 * can say path="color" and land on stops[2].color without knowing its index —
 * which is also what lets lists nest (colors inside lines). Add/remove write
 * the whole array back, cheaply, via the store's per-path structural sharing.
 */
import type { ReactNode } from 'react';

import { PathPrefixProvider } from './context';
import { normalizePath, type PathInput } from './store';
import { usePropValue, useSetProp } from './useControl';

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
  const items = usePropValue<TItem[]>(path);
  const setProp = useSetProp();
  const segments = normalizePath(path);

  const removeAt = (index: number) => {
    setProp(
      path,
      items.filter((_unused, itemIndex) => itemIndex !== index),
    );
  };

  const add = () => {
    setProp(path, [...items, createItem(items)]);
  };

  return (
    <div className="controls-section">
      <div className="controls-list-header">
        <span className="controls-section-title">{label}</span>
        <span>{`${items.length} / ${max}`}</span>
      </div>
      <ul className="controls-list">
        {items.map((_item, index) => (
          <li className="controls-list-row" key={index}>
            <div className="controls-list-row-header">
              <span>{`${itemLabel} ${index + 1}`}</span>
              <button
                className="controls-list-remove"
                disabled={items.length <= min}
                onClick={() => removeAt(index)}
                type="button"
              >
                {`Remove ${itemLabel} ${index + 1}`}
              </button>
            </div>
            <PathPrefixProvider segments={[...segments, index]}>
              {children(index)}
            </PathPrefixProvider>
          </li>
        ))}
      </ul>
      <button
        className="controls-button"
        disabled={items.length >= max}
        onClick={add}
        type="button"
      >
        {`Add ${itemLabel}`}
      </button>
    </div>
  );
}

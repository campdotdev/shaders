'use client';

/**
 * A variable-length list of anything: gradient stops, palette colors, wave
 * lines. Rows wrap their children in a path prefix, so path="color" inside
 * row 2 lands on stops[2].color without knowing its index, and lets lists
 * nest. Subscribes to the array's length only: a nested write rebuilds the
 * whole array's identity, so reading the array itself here would re-render
 * every row.
 *
 * Each row is one 24px line, the mock's layout: the row's name, then its
 * controls in their compact form, then a remove button, with an add button
 * up in the list's header. Controls learn they are inside a row from the
 * row trail (see context.tsx) and drop their own visible labels, since the
 * row already names them.
 *
 * A `collapsible` list is for rows whose contents are a whole nested list
 * (wave-lines' lines, each holding its own colors): the row's name becomes
 * a disclosure that folds the nested controls away, so a dozen lines fit in
 * the panel without the reader scrolling past every color of every line.
 */
import { type ReactNode, useId } from 'react';

import { Collapsible } from '@base-ui/react/collapsible';

import { CaretDownIcon } from '@/components/icons/caret-down';
import { CaretRightIcon } from '@/components/icons/caret-right';
import { MinusIcon } from '@/components/icons/minus';
import { PlusIcon } from '@/components/icons/plus';

import { ListRowProvider, PathPrefixProvider, useControlStore, useListRowTrail } from './context';
import styles from './controls.module.css';
import { normalizePath, type PathInput } from './store';
import { usePropValue, useResolvedPath, useSetProp } from './useControl';

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
   * Where the new item lands, given the current list. Defaults to appending;
   * lists whose items must stay ordered (e.g. gradient stops with a closing
   * end stop) use this to insert mid-list instead.
   */
  insertIndex?: (items: readonly TItem[]) => number;
  /** Singular noun for row names and button labels. Defaults to "item". */
  itemLabel?: string;
  /**
   * Folds each row's controls under its name, all closed to start. For rows
   * that hold a nested list rather than a line of compact controls.
   */
  collapsible?: boolean;
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
  collapsible = false,
  children,
}: ListInputProps<TItem>) {
  const store = useControlStore();
  const setProp = useSetProp();
  const resolvedPath = useResolvedPath(path);
  const segments = normalizePath(path);
  const ancestorTrail = useListRowTrail();
  const headingId = useId();

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
  const qualifier = ancestorTrail.length > 0 ? ancestorTrail.join(' > ') : label;

  const addLabel = `Add ${itemLabel}`;
  const addAriaLabel = `${addLabel} to ${qualifier}`;

  // A fixed-size list (min === max, e.g. mesh-gradient's two 4-color
  // palettes) has no legal add/remove. Rendering permanently-disabled
  // buttons would just be dead affordances, so skip them entirely.
  const fixedSize = min === max;

  return (
    <div aria-labelledby={headingId} className={styles.section} role="group">
      <div className={styles.sectionHeader}>
        <p className={`${styles.sectionTitle} ${styles.listTitle}`} id={headingId}>
          {label}
        </p>
        {!fixedSize && (
          <button
            aria-label={addAriaLabel}
            className={styles.iconButton}
            disabled={count >= max}
            onClick={add}
            title={addLabel}
            type="button"
          >
            <PlusIcon />
          </button>
        )}
      </div>
      <ul className={collapsible ? `${styles.list} ${styles.listCollapsible}` : styles.list}>
        {/* Rows are positional, not identity-keyed: removing row 1 genuinely
            shifts row 2 into its place, and the path prefix follows the
            position. A stable per-item id would be dead weight here since
            nothing preserves per-row UI state across a shift; a collapsible
            row's open state is the one exception, and it simply stays with
            the position, which is what a reader watching row 2 slide up into
            row 1's place expects to see anyway. */}
        {Array.from({ length: count }, (_unused, index) => {
          const ownLabel = `${itemLabel} ${index + 1}`;
          const removeLabel = `Remove ${ownLabel}`;
          const removeAriaLabel = `${removeLabel} from ${qualifier}`;
          const removeButton = !fixedSize && (
            <button
              aria-label={removeAriaLabel}
              className={styles.iconButton}
              disabled={count <= min}
              onClick={() => removeAt(index)}
              title={removeLabel}
              type="button"
            >
              <MinusIcon />
            </button>
          );
          const contents = (
            <PathPrefixProvider segments={[...segments, index]}>
              <ListRowProvider trail={[...ancestorTrail, ownLabel]}>
                {children(index)}
              </ListRowProvider>
            </PathPrefixProvider>
          );

          if (collapsible) {
            return (
              <li className={styles.listRow} data-list-row="" key={index}>
                <Collapsible.Root className={styles.disclosure}>
                  <div className={styles.disclosureHeader}>
                    {/* Both glyphs render and CSS shows one, keyed off Base
                        UI's data-panel-open, so the swap needs no state. */}
                    <Collapsible.Trigger className={styles.disclosureTrigger}>
                      <CaretRightIcon
                        className={styles.disclosureClosedIcon}
                        height="16"
                        width="16"
                      />
                      <CaretDownIcon className={styles.disclosureOpenIcon} />
                      <span className={styles.rowLabel}>{ownLabel}</span>
                    </Collapsible.Trigger>
                    {removeButton}
                  </div>
                  <Collapsible.Panel className={styles.disclosurePanel}>
                    <div className={styles.disclosureContents}>{contents}</div>
                  </Collapsible.Panel>
                </Collapsible.Root>
              </li>
            );
          }

          return (
            <li className={styles.listRow} data-list-row="" key={index}>
              <span className={styles.rowLabel}>{ownLabel}</span>
              {contents}
              {removeButton}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

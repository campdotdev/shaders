/**
 * The highlight in the docs search: which result row is selected, the arrow
 * keys and Enter on the input that move and open it, and the scroll that
 * keeps it in view. search.tsx wires the handlers onto the input, and
 * search-results.tsx renders the rows the highlight points at.
 */
import { type KeyboardEvent, useEffect, useRef, useState } from 'react';

import type { SearchResult } from './use-search-backend';

// What each arrow key does to the highlight. Down stops on the last row,
// and on row 0 when there are none. Up stops on the first.
const ARROW_MOVES = new Map<string, (index: number, resultCount: number) => number>([
  ['ArrowDown', (index, resultCount) => Math.min(index + 1, Math.max(0, resultCount - 1))],
  ['ArrowUp', (index) => Math.max(0, index - 1)],
]);

// The id a result row carries, which the input's aria-activedescendant
// points at while that row is highlighted.
export function resultOptionId(index: number): string {
  return `search-result-${index}`;
}

export function useHighlight(results: SearchResult[], onChoose: (url: string) => void) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  // Which input last moved the highlight. The scroll effect below reads it
  // to scroll for the arrow keys and leave a pointer hover alone.
  const selectionSourceRef = useRef<'keyboard' | 'pointer'>('keyboard');

  // ---------------------------------------------
  // Keys on the input
  // ---------------------------------------------

  // Enter opens the highlighted row, and only claims the key when there is
  // one to open.
  const openHighlighted = (event: KeyboardEvent<HTMLInputElement>) => {
    const target = results[selectedIndex];

    if (!target) return;
    event.preventDefault();
    onChoose(target.url);
  };

  // Focus stays on the input while the arrow keys move the highlight, so
  // the input's aria-activedescendant is what tells a screen reader which
  // row is selected. Composition gets the keys first: Enter may be
  // confirming an IME candidate rather than asking search to navigate.
  const onInputKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;

    if (event.key === 'Enter') {
      openHighlighted(event);

      return;
    }
    const move = ARROW_MOVES.get(event.key);

    if (!move) return;
    event.preventDefault();
    selectionSourceRef.current = 'keyboard';
    setSelectedIndex((index) => move(index, results.length));
  };

  // ---------------------------------------------
  // Pointer and reset
  // ---------------------------------------------

  const highlightFromPointer = (index: number) => {
    selectionSourceRef.current = 'pointer';
    setSelectedIndex(index);
  };

  // A new query means a new list, and the old highlight position has no
  // meaning on it, so the caller resets at event time rather than clamping
  // in a follow-up effect once shorter results land.
  const resetHighlight = () => setSelectedIndex(0);

  // ---------------------------------------------
  // Keeping the highlight in view
  // ---------------------------------------------

  // Keeps the highlighted row in view as the arrow keys walk a list longer
  // than the results cap. The rows carry a scroll margin the height of the
  // edge fades (search.module.css), so a keyboard-selected row lands clear
  // of either gradient. Only the keyboard gets that: a pointer hovering a
  // row under a fade would otherwise scroll the list, slide a different row
  // under the pointer, and hover that one too, so the list jumps while the
  // reader is trying to click.
  useEffect(() => {
    const list = listRef.current;

    if (!list || selectionSourceRef.current === 'pointer') return;
    const selected = list.children[selectedIndex];

    if (selected instanceof HTMLElement) selected.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const activeOptionId = results[selectedIndex] ? resultOptionId(selectedIndex) : undefined;

  return {
    activeOptionId,
    highlightFromPointer,
    listRef,
    onInputKey,
    resetHighlight,
    selectedIndex,
  };
}

'use client';

/**
 * The docs search after the Figma mock (SHA-155): the search trigger in the
 * header and the search panel it opens over the blurred page. Base UI Dialog
 * owns modal behavior. use-panel-open.ts owns the open state, the shortcut,
 * and focus return, use-highlight.ts the selected row, search-results.tsx
 * what shows under the input, and use-search-backend.ts Pagefind and its
 * fallback. Names follow GLOSSARY.md: trigger and panel.
 */
import { useRouter } from 'next/navigation';
import { useCallback, useRef, useState } from 'react';

import { Dialog } from '@base-ui/react/dialog';

import backdropStyles from '@/components/overlay-backdrop/overlay-backdrop.module.css';
import textButtonStyles from '@/components/text-button/text-button.module.css';
import visuallyHiddenStyles from '@/components/visually-hidden/visually-hidden.module.css';

import { SearchResults, SearchStatus } from './search-results';
import styles from './search.module.css';
import { useHighlight } from './use-highlight';
import { usePanelOpen } from './use-panel-open';
import { useSearchBackend } from './use-search-backend';

export function Search() {
  const router = useRouter();
  const { finalFocus, open, rememberFocus, setOpen, triggerRef } = usePanelOpen();
  const [query, setQuery] = useState('');
  const { backendState, queryState, resetSearch, results } = useSearchBackend(open, query);
  const inputRef = useRef<HTMLInputElement>(null);

  const navigate = useCallback(
    (url: string) => {
      setOpen(false);
      router.push(url);
    },
    [router, setOpen],
  );
  const {
    activeOptionId,
    highlightFromPointer,
    listRef,
    onInputKey,
    resetHighlight,
    selectedIndex,
  } = useHighlight(results, navigate);

  // A fresh panel is the input alone, so the query and the highlight reset
  // between opens. That happens after the exit has finished rather than
  // when the close starts: the panel fades and scales out over 150ms, and
  // emptying the list at the first frame of that would collapse the card
  // mid-exit. A reopen inside that window keeps the query, which is what a
  // reader who closed by accident wants.
  const resetAfterClose = (isOpen: boolean) => {
    if (isOpen) return;
    setQuery('');
    resetHighlight();
    resetSearch();
  };

  return (
    <Dialog.Root onOpenChange={setOpen} onOpenChangeComplete={resetAfterClose} open={open}>
      <Dialog.Trigger
        aria-label="Open search"
        className={`${textButtonStyles.box} ${styles.trigger}`}
        onPointerDown={rememberFocus}
        ref={triggerRef}
      >
        <kbd className={styles.hint}>Cmd+k</kbd>
        <span>Search...</span>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className={`${backdropStyles.backdrop} ${styles.backdrop}`} />
        {/* The input takes focus on every open, a shortcut open included.
            finalFocus in use-panel-open.ts picks where it goes on close. */}
        <Dialog.Popup className={styles.panel} finalFocus={finalFocus} initialFocus={inputRef}>
          <Dialog.Title className={visuallyHiddenStyles.srOnly}>Search</Dialog.Title>
          <div className={styles.inputRow}>
            <input
              aria-activedescendant={activeOptionId}
              aria-autocomplete="list"
              aria-controls="search-results"
              aria-expanded={open}
              aria-label="Search query"
              className={styles.input}
              onChange={(event) => {
                setQuery(event.target.value);
                resetHighlight();
              }}
              onKeyDown={onInputKey}
              placeholder="Search"
              ref={inputRef}
              role="combobox"
              type="text"
              value={query}
            />
            <Dialog.Close aria-label="Close search" className={styles.close}>
              esc
            </Dialog.Close>
          </div>
          <SearchStatus
            backendState={backendState}
            hasQuery={query.trim() !== ''}
            queryState={queryState}
            resultCount={results.length}
          />
          <SearchResults
            listRef={listRef}
            onChoose={navigate}
            onHover={highlightFromPointer}
            results={results}
            selectedIndex={selectedIndex}
          />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

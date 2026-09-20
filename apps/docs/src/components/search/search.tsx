'use client';

/**
 * The docs search after the Figma mock (SHA-155): the search trigger in the
 * header and the search panel it opens over the blurred page. Base UI Dialog
 * owns modal behavior; use-search-backend.ts owns Pagefind and its fallback.
 * Names follow CONTEXT.md: trigger and panel.
 */
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Dialog } from '@base-ui/react/dialog';

import backdropStyles from '@/components/overlay-backdrop/overlay-backdrop.module.css';
import { ScrollArea } from '@/components/scroll-area/scroll-area';

import styles from './search.module.css';
import { useSearchBackend } from './use-search-backend';

export function Search() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { backendState, queryState, results } = useSearchBackend(open, query);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // ---------------------------------------------
  // Opening and closing
  // ---------------------------------------------

  // Cmd+k and Ctrl+k toggle the panel from anywhere on the page, so the
  // shortcut both opens and, when the panel is already up, closes. Both
  // modifiers on purpose, with no platform detection: the hint on the
  // trigger reads the one literal "Cmd+k" either way. Escape, the backdrop
  // press, and the esc hint all go through Base UI's onOpenChange below.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        setOpen((isOpen) => !isOpen);
      }
    };

    window.addEventListener('keydown', onKey);

    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // A fresh panel is the input alone, so the query and the highlight reset
  // between opens. That happens after the exit has finished rather than
  // when the close starts: the panel fades and scales out over 150ms, and
  // emptying the list at the first frame of that would collapse the card
  // mid-exit. A reopen inside that window keeps the query, which is what a
  // reader who closed by accident wants.
  const resetAfterClose = (isOpen: boolean) => {
    if (isOpen) return;
    setQuery('');
    setSelectedIndex(0);
  };

  const navigate = useCallback(
    (url: string) => {
      setOpen(false);
      router.push(url);
    },
    [router],
  );

  // ---------------------------------------------
  // The highlight
  // ---------------------------------------------

  // Focus stays on the input while the arrow keys move the highlight, so
  // the input's aria-activedescendant is what tells a screen reader which
  // row is selected. Enter opens the highlighted row. Composition gets the
  // keys first: Enter may be confirming an IME candidate rather than asking
  // search to navigate.
  const onInputKey = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIndex((index) => Math.min(index + 1, Math.max(0, results.length - 1)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIndex((index) => Math.max(0, index - 1));
    } else if (event.key === 'Enter') {
      const target = results[selectedIndex];

      if (target) {
        event.preventDefault();
        navigate(target.url);
      }
    }
  };

  // Keeps the highlighted row in view as the arrow keys walk a list longer
  // than the results cap.
  useEffect(() => {
    const list = listRef.current;

    if (!list) return;
    const selected = list.children[selectedIndex];

    if (selected instanceof HTMLElement) selected.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const hasQuery = query.trim() !== '';
  const loading = hasQuery && (backendState === 'loading' || queryState === 'loading');
  const unavailable = backendState === 'unavailable' || queryState === 'unavailable';

  return (
    <Dialog.Root onOpenChange={setOpen} onOpenChangeComplete={resetAfterClose} open={open}>
      <Dialog.Trigger aria-label="Open search" className={styles.trigger} ref={triggerRef}>
        <kbd className={styles.hint}>Cmd+k</kbd>
        <span>Search...</span>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className={`${backdropStyles.backdrop} ${styles.backdrop}`} />
        {/* The input takes focus on every open, a shortcut open included,
            and focus goes back to the trigger on every close, a shortcut
            close included. Base UI's defaults would focus the popup itself
            on a touch open and return focus to whatever had it before a
            shortcut open, which is the page body. */}
        <Dialog.Popup className={styles.panel} finalFocus={triggerRef} initialFocus={inputRef}>
          <Dialog.Title className={styles.srOnly}>Search</Dialog.Title>
          <div className={styles.inputRow}>
            <input
              aria-activedescendant={
                results[selectedIndex] ? `search-result-${selectedIndex}` : undefined
              }
              aria-autocomplete="list"
              aria-controls="search-results"
              aria-expanded={open}
              aria-label="Search query"
              className={styles.input}
              onChange={(event) => {
                // Reset the highlight here, at event time, rather than
                // clamping it in a follow-up effect once shorter results
                // land: a new query means a new list, and the old
                // highlight position has no meaning on it.
                setQuery(event.target.value);
                setSelectedIndex(0);
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
          {/* Loading, unavailable, and no-results messages live outside the
              listbox: a listbox may only contain options, and role="status"
              makes a screen reader announce these as they change. They
              never coexist with results, because results stay empty until
              the backend is ready, so the list below is empty whenever one
              shows. A fresh panel shows none of them: an empty list for a
              query nobody has typed is not a state, and neither is a backend
              still loading behind an empty input. The backend starts on the
              first open, so the loading line only appears when the reader
              types before it is ready. */}
          <div role="status">
            {loading && <p className={styles.message}>Loading results…</p>}
            {unavailable && hasQuery && (
              <p className={styles.message}>
                Search index unavailable. Build the docs to generate the Pagefind index.
              </p>
            )}
            {hasQuery &&
              backendState === 'ready' &&
              queryState === 'ready' &&
              results.length === 0 && <p className={styles.message}>No results found.</p>}
          </div>
          {/* The rows scroll inside the shared ScrollArea under the cap in
              search.module.css; the list keeps the listbox role so it still
              contains only options. */}
          <ScrollArea viewportClassName={styles.resultsViewport}>
            <ul className={styles.results} id="search-results" ref={listRef} role="listbox">
              {results.map((result, resultIndex) => (
                <li
                  aria-selected={resultIndex === selectedIndex}
                  className={styles.row}
                  id={`search-result-${resultIndex}`}
                  key={result.url}
                  onClick={() => navigate(result.url)}
                  onMouseEnter={() => setSelectedIndex(resultIndex)}
                  role="option"
                >
                  <div className={styles.title}>{result.title}</div>
                  <div
                    className={styles.excerpt}
                    // Pagefind escapes indexed text and adds <mark>; fallback
                    // excerpts are this repo's own frontmatter descriptions.
                    // First-party static content: accepted, not re-sanitized.
                    // react-doctor-disable-next-line react-doctor/dangerous-html-sink
                    dangerouslySetInnerHTML={{ __html: result.excerpt }}
                  />
                </li>
              ))}
            </ul>
          </ScrollArea>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

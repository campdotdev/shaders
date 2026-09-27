'use client';

/**
 * What the search panel shows under its input: a status line while results
 * load, when the index is missing, or when nothing matched, and the listbox
 * of result rows. search.tsx owns the query and the backend, and
 * use-highlight.ts owns which row is selected.
 */
import type { RefObject } from 'react';

import { ScrollArea } from '@/components/scroll-area/scroll-area';

import styles from './search.module.css';
import { resultOptionId } from './use-highlight';
import type { SearchResult, useSearchBackend } from './use-search-backend';

type BackendStates = Pick<ReturnType<typeof useSearchBackend>, 'backendState' | 'queryState'>;

// How far from either edge of the results, in px, still counts as reaching
// it before the fade over that edge goes off. The top matches the list's
// 8px of top padding, the sidebar's reasoning (docs-sidebar.tsx): a scroll
// that small tucks nothing but padding under the edge, so the first row is
// still whole and a fade would only dim it. The list has no bottom padding,
// so the bottom allows 1px, enough to absorb the fraction of a pixel a 50vh
// cap can leave over an integer list without ever hiding a visible sliver.
const FADE_THRESHOLD_PX = { yStart: 8, yEnd: 1 };

// ---------------------------------------------
// The status line
// ---------------------------------------------

interface StatusMessage {
  text: string;
  shows: (states: BackendStates, resultCount: number) => boolean;
}

// Each message and the backend states that show it. They never coexist with
// results, because results stay empty until the backend is ready, so the
// list below is empty whenever one shows.
const STATUS_MESSAGES: StatusMessage[] = [
  {
    text: 'Loading results…',
    shows: ({ backendState, queryState }) => backendState === 'loading' || queryState === 'loading',
  },
  {
    text: 'Search index unavailable. Build the docs to generate the Pagefind index.',
    shows: ({ backendState, queryState }) =>
      backendState === 'unavailable' || queryState === 'unavailable',
  },
  {
    text: 'No results found.',
    shows: ({ backendState, queryState }, resultCount) =>
      backendState === 'ready' && queryState === 'ready' && resultCount === 0,
  },
];

interface SearchStatusProps extends BackendStates {
  /** Whether the input holds anything besides whitespace. */
  hasQuery: boolean;
  /** How many rows the list below is showing. */
  resultCount: number;
}

// The messages live outside the listbox: a listbox may only contain
// options, and role="status" makes a screen reader announce them as they
// change. A fresh panel shows none of them: an empty list for a query
// nobody has typed is not a state, and neither is a backend still loading
// behind an empty input. The backend starts on the first open, so the
// loading line only appears when the reader types before it is ready.
export function SearchStatus({
  backendState,
  queryState,
  hasQuery,
  resultCount,
}: SearchStatusProps) {
  const states = { backendState, queryState };

  return (
    <div role="status">
      {hasQuery &&
        STATUS_MESSAGES.filter((message) => message.shows(states, resultCount)).map((message) => (
          <p className={styles.message} key={message.text}>
            {message.text}
          </p>
        ))}
    </div>
  );
}

// ---------------------------------------------
// The result rows
// ---------------------------------------------

interface SearchResultsProps {
  /** The rows to show, in rank order. */
  results: SearchResult[];
  /** The index of the highlighted row. */
  selectedIndex: number;
  /** The listbox element, which the highlight scrolls to keep its row in view. */
  listRef: RefObject<HTMLUListElement | null>;
  /** Opens a row's page. */
  onChoose: (url: string) => void;
  /** Moves the highlight to the row under the pointer. */
  onHover: (index: number) => void;
}

// The rows scroll inside the shared ScrollArea under the cap in
// search.module.css, with both edge fades on so a row clipped by the cap
// reads as clipped rather than as the last result. The list keeps the
// listbox role so it still contains only options.
export function SearchResults({
  results,
  selectedIndex,
  listRef,
  onChoose,
  onHover,
}: SearchResultsProps) {
  return (
    <ScrollArea
      className={styles.resultsScroller}
      edgeFades="both"
      overflowEdgeThreshold={FADE_THRESHOLD_PX}
      viewportClassName={styles.resultsViewport}
    >
      <ul className={styles.results} id="search-results" ref={listRef} role="listbox">
        {results.map((result, resultIndex) => (
          <li
            aria-selected={resultIndex === selectedIndex}
            className={styles.row}
            id={resultOptionId(resultIndex)}
            key={result.url}
            onClick={() => onChoose(result.url)}
            onMouseEnter={() => onHover(resultIndex)}
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
  );
}

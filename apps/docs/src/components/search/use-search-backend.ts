/**
 * The data half of the docs search. It loads Pagefind lazily when the panel
 * first opens, falls back to /api/search when no index exists, and exposes
 * backend state, query state, and results to search.tsx.
 */
import { useEffect, useRef, useState } from 'react';

export interface SearchResult {
  url: string;
  title: string;
  /** HTML: Pagefind's excerpt with its <mark> tags, or the fallback's description. */
  excerpt: string;
}

interface SearchDoc {
  url: string;
  title: string;
  description: string;
  section: string;
  headings: string[];
  tags: string[];
}

type SearchBackend = (query: string) => Promise<SearchResult[]>;

interface PagefindModule {
  search(query: string): Promise<{
    results: Array<{
      id: string;
      data(): Promise<{
        url: string;
        excerpt: string;
        meta?: { title?: string };
      }>;
    }>;
  }>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isPagefindModule(value: unknown): value is PagefindModule {
  return isRecord(value) && typeof value.search === 'function';
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isSearchDoc(value: unknown): value is SearchDoc {
  return (
    isRecord(value) &&
    typeof value.url === 'string' &&
    typeof value.title === 'string' &&
    typeof value.description === 'string' &&
    typeof value.section === 'string' &&
    isStringArray(value.headings) &&
    isStringArray(value.tags)
  );
}

// ---------------------------------------------
// The two backends
// ---------------------------------------------

async function createPagefindBackend(): Promise<SearchBackend | null> {
  try {
    const path = '/pagefind/pagefind.js';
    const pagefindModule: unknown = await import(/* webpackIgnore: true */ path);

    if (!isPagefindModule(pagefindModule)) return null;

    return async (query) => {
      if (query.trim() === '') return [];
      const search = await pagefindModule.search(query);
      const items = await Promise.all(search.results.slice(0, 20).map((result) => result.data()));

      return items.map((resultData) => ({
        url: resultData.url.replace(/\.html$/, '').replace(/\/index$/, '/'),
        title: resultData.meta?.title ?? resultData.url,
        excerpt: resultData.excerpt,
      }));
    };
  } catch {
    return null;
  }
}

function matches(doc: SearchDoc, normalizedQuery: string): boolean {
  return (
    doc.title.toLowerCase().includes(normalizedQuery) ||
    doc.description.toLowerCase().includes(normalizedQuery) ||
    doc.section.toLowerCase().includes(normalizedQuery) ||
    doc.headings.some((heading) => heading.toLowerCase().includes(normalizedQuery)) ||
    doc.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery))
  );
}

async function createFallbackBackend(): Promise<SearchBackend | null> {
  try {
    const response = await fetch('/api/search');

    if (!response.ok) return null;
    const docsJson: unknown = await response.json();

    if (!Array.isArray(docsJson) || !docsJson.every(isSearchDoc)) return null;
    const docs = docsJson;

    return (query) => {
      const normalizedQuery = query.toLowerCase().trim();

      if (normalizedQuery === '') return Promise.resolve([]);

      return Promise.resolve(
        docs
          .filter((doc) => matches(doc, normalizedQuery))
          .slice(0, 20)
          .map((doc) => ({ url: doc.url, title: doc.title, excerpt: doc.description })),
      );
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------
// The hook
// ---------------------------------------------

// One stable empty list, so an empty query hands back the same reference
// every render rather than a fresh array.
const NO_RESULTS: SearchResult[] = [];

export function useSearchBackend(open: boolean, query: string) {
  const [resultSet, setResultSet] = useState<{ query: string; items: SearchResult[] }>({
    query: '',
    items: NO_RESULTS,
  });
  const [backendState, setBackendState] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const [queryStatus, setQueryStatus] = useState<{
    query: string;
    state: 'idle' | 'loading' | 'ready' | 'unavailable';
  }>({ query: '', state: 'idle' });
  const backendRef = useRef<SearchBackend | null>(null);

  // One-time lazy init of the search backend, deliberately in an effect: the
  // site is a static export, so Pagefind's index only exists as client-side
  // assets — there is no server or data layer to move this into. The abort
  // guard drops the write from a stale run, and the ref caches the backend
  // across open/close cycles.
  // react-doctor-disable-next-line react-doctor/no-fetch-in-effect, react-doctor/no-set-state-after-await-in-effect
  useEffect(() => {
    if (!open || backendRef.current) return;
    const abortController = new AbortController();

    void (async () => {
      const backend = (await createPagefindBackend()) ?? (await createFallbackBackend());

      if (abortController.signal.aborted) return;
      backendRef.current = backend;
      setBackendState(backend ? 'ready' : 'unavailable');
    })();

    return () => {
      abortController.abort();
    };
  }, [open]);

  // Re-query on every keystroke once the backend is ready. Results and status
  // carry the query that produced them, so old rows and messages disappear
  // immediately when the reader types again rather than staying actionable
  // while the next request runs. Nothing clears on close: the panel fades
  // out over the rows it was showing, and the component resets the query once
  // that exit has finished, which empties the list before the next open.
  useEffect(() => {
    if (!open || query.trim() === '' || backendState !== 'ready' || !backendRef.current) return;
    const backend = backendRef.current;
    let cancelled = false;

    setQueryStatus({ query, state: 'loading' });
    void backend(query).then(
      (searchResults) => {
        if (cancelled) return;
        setResultSet({ query, items: searchResults });
        setQueryStatus({ query, state: 'ready' });
      },
      () => {
        if (!cancelled) setQueryStatus({ query, state: 'unavailable' });
      },
    );

    return () => {
      cancelled = true;
    };
  }, [open, query, backendState]);

  const results = query.trim() !== '' && resultSet.query === query ? resultSet.items : NO_RESULTS;
  const queryState =
    query.trim() !== '' && backendState === 'ready' && queryStatus.query !== query
      ? 'loading'
      : queryStatus.state;

  return { backendState, queryState, results };
}

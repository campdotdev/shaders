'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

interface SearchResult {
  url: string;
  title: string;
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

// Owns the data half of the search bar: lazily standing up a backend the
// first time the modal opens, and re-querying it as the user types. The UI
// component below only consumes { backendState, results }.
function useSearchBackend(open: boolean, query: string) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [backendState, setBackendState] = useState<'loading' | 'ready' | 'unavailable'>('loading');
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

  useEffect(() => {
    // Closed means no visible list — drop stale results so reopening starts
    // from a clean "Type to search." state.
    if (!open) {
      setResults([]);

      return;
    }
    if (backendState !== 'ready' || !backendRef.current) return;
    const backend = backendRef.current;
    let cancelled = false;

    void backend(query).then((searchResults) => {
      if (!cancelled) setResults(searchResults);
    });

    return () => {
      cancelled = true;
    };
  }, [open, query, backendState]);

  return { backendState, results };
}

// Shared look for the three status-region messages (loading / unavailable /
// no results) rendered above the results listbox.
const statusMessageStyle: React.CSSProperties = {
  margin: 0,
  padding: '1rem',
  color: 'var(--fg-muted)',
  fontSize: '0.875rem',
};

export function SearchBar() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { backendState, results } = useSearchBackend(open, query);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Only ⌘K lives here — Escape is handled by the native <dialog>, whose
  // cancel event fires onCancel below.
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

  // The dialog stays mounted and this effect drives it between modal and
  // closed. showModal() is what grants focus trapping (Tab cycles inside the
  // dialog instead of escaping behind the overlay) and native Escape
  // handling, neither of which a styled div with role="dialog" ever gets.
  // close() matters just as much: it runs the native teardown — leaving the
  // top layer and restoring focus to the search button — which unmounting an
  // open dialog would skip. Closing an already-closed dialog is a no-op, so
  // the initial render and the onClose → setOpen(false) echo are both safe.
  useEffect(() => {
    if (open) {
      dialogRef.current?.showModal();
    } else {
      dialogRef.current?.close();
    }
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
    if (!open) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [open]);

  const navigate = useCallback(
    (url: string) => {
      setOpen(false);
      router.push(url);
    },
    [router],
  );

  const onInputKey = (event: React.KeyboardEvent<HTMLInputElement>) => {
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

  useEffect(() => {
    const list = listRef.current;

    if (!list) return;
    const selected = list.children[selectedIndex];

    if (selected instanceof HTMLElement) selected.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  return (
    <>
      <button
        aria-label="Open search"
        onClick={() => setOpen(true)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.375rem 0.625rem',
          borderRadius: '0.375rem',
          border: '1px solid var(--border)',
          background: 'var(--bg-muted)',
          color: 'var(--fg-muted)',
          fontSize: '0.8125rem',
          fontFamily: 'inherit',
          cursor: 'pointer',
          minWidth: 200,
          justifyContent: 'space-between',
        }}
        type="button"
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <SearchIcon />
          Search docs
        </span>
        <kbd
          style={{
            fontSize: '0.7rem',
            padding: '0.125rem 0.375rem',
            border: '1px solid var(--border)',
            borderRadius: '0.25rem',
            background: 'var(--bg)',
            fontFamily: 'inherit',
          }}
        >
          ⌘K
        </kbd>
      </button>
      {/* The click handler is backdrop light-dismiss, a pointer-only
          nicety — keyboard and screen reader users close the modal through
          the dialog's native Escape/cancel path, so no interactive role is
          missing here. */}
      {/* react-doctor-disable-next-line react-doctor/no-noninteractive-element-interactions */}
      <dialog
        aria-label="Search"
        className="search-dialog"
        onCancel={() => setOpen(false)}
        onClick={(event) => {
          // A click on the dimmed ::backdrop reports the <dialog> element
          // itself as the target; clicks inside the panel target children.
          if (event.target === event.currentTarget) setOpen(false);
        }}
        onClose={() => setOpen(false)}
        ref={dialogRef}
        style={{
          width: 'min(640px, calc(100vw - 2rem))',
          margin: '12vh auto auto',
          padding: 0,
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: '0.75rem',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.875rem 1rem',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <SearchIcon />
          <input
            // Focus stays on the input while arrow keys move the highlight,
            // so aria-activedescendant is what tells a screen reader which
            // option is selected — without it the ArrowDown/ArrowUp
            // selection is silent.
            aria-activedescendant={
              results[selectedIndex] ? `search-result-${selectedIndex}` : undefined
            }
            aria-autocomplete="list"
            aria-controls="search-results"
            aria-expanded={open}
            aria-label="Search query"
            onChange={(event) => {
              // Reset the selection here, at event time, rather than
              // clamping it in a follow-up effect once shorter results
              // land — a new query means a new list, and the old
              // highlight position has no meaning on it.
              setQuery(event.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={onInputKey}
            placeholder="Search docs…"
            ref={inputRef}
            role="combobox"
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              color: 'var(--fg)',
              fontSize: '0.9375rem',
              fontFamily: 'inherit',
            }}
            type="text"
            value={query}
          />
          <kbd
            style={{
              fontSize: '0.7rem',
              padding: '0.125rem 0.375rem',
              border: '1px solid var(--border)',
              borderRadius: '0.25rem',
              color: 'var(--fg-muted)',
            }}
          >
            Esc
          </kbd>
        </div>
        {/* Loading/unavailable/empty messages live outside the listbox: a
            listbox may only contain options, and role="status" makes a
            screen reader announce these updates as they change. The messages
            never coexist with results (results stay empty until the backend
            is ready), so the listbox below is empty whenever one shows. */}
        <div role="status">
          {backendState === 'loading' && <p style={statusMessageStyle}>Loading search…</p>}
          {backendState === 'unavailable' && (
            <p style={statusMessageStyle}>
              Search index unavailable. Build the docs to generate the Pagefind index.
            </p>
          )}
          {backendState === 'ready' && results.length === 0 && (
            <p style={statusMessageStyle}>
              {query.trim() !== '' ? `No results for "${query}"` : 'Type to search.'}
            </p>
          )}
        </div>
        <ul
          id="search-results"
          ref={listRef}
          role="listbox"
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            maxHeight: '50vh',
            overflowY: 'auto',
          }}
        >
          {results.map((result, resultIndex) => (
            <li
              aria-selected={resultIndex === selectedIndex}
              id={`search-result-${resultIndex}`}
              key={result.url}
              onClick={() => navigate(result.url)}
              onMouseEnter={() => setSelectedIndex(resultIndex)}
              role="option"
              style={{
                padding: '0.625rem 1rem',
                cursor: 'pointer',
                background: resultIndex === selectedIndex ? 'var(--bg-muted)' : 'transparent',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <div style={{ fontWeight: 500, color: 'var(--fg)' }}>{result.title}</div>
              <div
                // Pagefind escapes indexed text and adds <mark>; fallback
                // excerpts are this repo's own frontmatter descriptions.
                // First-party static content — accepted, not re-sanitized.
                // react-doctor-disable-next-line react-doctor/dangerous-html-sink
                dangerouslySetInnerHTML={{ __html: result.excerpt }}
                style={{
                  fontSize: '0.8125rem',
                  color: 'var(--fg-muted)',
                  marginTop: '0.25rem',
                  lineHeight: 1.4,
                }}
              />
            </li>
          ))}
        </ul>
      </dialog>
    </>
  );
}

function SearchIcon() {
  return (
    <svg
      aria-hidden
      fill="none"
      height="14"
      viewBox="0 0 16 16"
      width="14"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M11 11L14 14" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
    </svg>
  );
}

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

export function SearchBar() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [backendState, setBackendState] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const backendRef = useRef<SearchBackend | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

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
    if (!open || backendState !== 'ready' || !backendRef.current) return;
    const backend = backendRef.current;
    let cancelled = false;

    void backend(query).then((searchResults) => {
      if (!cancelled) setResults(searchResults);
    });

    return () => {
      cancelled = true;
    };
  }, [open, query, backendState]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        setOpen((isOpen) => !isOpen);
      } else if (event.key === 'Escape' && open) {
        setOpen(false);
      }
    };

    window.addEventListener('keydown', onKey);

    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
    if (!open) {
      setQuery('');
      setSelectedIndex(0);
      setResults([]);
    }
  }, [open]);

  useEffect(() => {
    if (selectedIndex >= results.length) setSelectedIndex(0);
  }, [results.length, selectedIndex]);

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
      {open && (
        <div
          aria-label="Search"
          aria-modal="true"
          onClick={() => setOpen(false)}
          role="dialog"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-start',
            paddingTop: '12vh',
            background: 'rgba(0, 0, 0, 0.5)',
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: 'min(640px, calc(100vw - 2rem))',
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
                aria-label="Search query"
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={onInputKey}
                placeholder="Search docs…"
                ref={inputRef}
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
            <ul
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
              {backendState === 'loading' && (
                <li
                  style={{
                    padding: '1rem',
                    color: 'var(--fg-muted)',
                    fontSize: '0.875rem',
                  }}
                >
                  Loading search…
                </li>
              )}
              {backendState === 'unavailable' && (
                <li
                  style={{
                    padding: '1rem',
                    color: 'var(--fg-muted)',
                    fontSize: '0.875rem',
                  }}
                >
                  Search index unavailable. Build the docs to generate the Pagefind index.
                </li>
              )}
              {backendState === 'ready' && results.length === 0 && (
                <li
                  style={{
                    padding: '1rem',
                    color: 'var(--fg-muted)',
                    fontSize: '0.875rem',
                  }}
                >
                  {query.trim() !== '' ? `No results for "${query}"` : 'Type to search.'}
                </li>
              )}
              {results.map((result, resultIndex) => (
                <li
                  aria-selected={resultIndex === selectedIndex}
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
          </div>
        </div>
      )}
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

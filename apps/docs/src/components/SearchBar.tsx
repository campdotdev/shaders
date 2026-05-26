'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

interface SearchResult {
  url: string
  title: string
  excerpt: string
}

interface SearchDoc {
  url: string
  title: string
  description: string
  section: string
  headings: string[]
  tags: string[]
}

type SearchBackend = (query: string) => Promise<SearchResult[]>

interface PagefindModule {
  search(query: string): Promise<{
    results: Array<{
      id: string
      data(): Promise<{
        url: string
        excerpt: string
        meta?: { title?: string }
      }>
    }>
  }>
}

async function createPagefindBackend(): Promise<SearchBackend | null> {
  try {
    const path = '/pagefind/pagefind.js'
    const mod = (await import(/* webpackIgnore: true */ path)) as PagefindModule
    return async (query) => {
      if (!query.trim()) return []
      const search = await mod.search(query)
      const items = await Promise.all(search.results.slice(0, 20).map((r) => r.data()))
      return items.map((d) => ({
        url: d.url.replace(/\.html$/, '').replace(/\/index$/, '/'),
        title: d.meta?.title ?? d.url,
        excerpt: d.excerpt,
      }))
    }
  } catch {
    return null
  }
}

function matches(doc: SearchDoc, q: string): boolean {
  return (
    doc.title.toLowerCase().includes(q) ||
    doc.description.toLowerCase().includes(q) ||
    doc.section.toLowerCase().includes(q) ||
    doc.headings.some((h) => h.toLowerCase().includes(q)) ||
    doc.tags.some((t) => t.toLowerCase().includes(q))
  )
}

async function createFallbackBackend(): Promise<SearchBackend | null> {
  try {
    const res = await fetch('/api/search')
    if (!res.ok) return null
    const docs = (await res.json()) as SearchDoc[]
    return async (query) => {
      const q = query.toLowerCase().trim()
      if (!q) return []
      return docs
        .filter((d) => matches(d, q))
        .slice(0, 20)
        .map((d) => ({ url: d.url, title: d.title, excerpt: d.description }))
    }
  } catch {
    return null
  }
}

export function SearchBar() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [backendState, setBackendState] = useState<'loading' | 'ready' | 'unavailable'>('loading')
  const backendRef = useRef<SearchBackend | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  // Lazy-load the backend on first open. Pagefind first, /api/search fallback.
  useEffect(() => {
    if (!open || backendRef.current) return
    let cancelled = false
    void (async () => {
      const backend = (await createPagefindBackend()) ?? (await createFallbackBackend())
      if (cancelled) return
      backendRef.current = backend
      setBackendState(backend ? 'ready' : 'unavailable')
    })()
    return () => {
      cancelled = true
    }
  }, [open])

  // Run a query through the active backend
  useEffect(() => {
    if (!open || backendState !== 'ready' || !backendRef.current) return
    const backend = backendRef.current
    let cancelled = false
    void backend(query).then((r) => {
      if (!cancelled) setResults(r)
    })
    return () => {
      cancelled = true
    }
  }, [open, query, backendState])

  // Cmd+K / Ctrl+K to toggle, Esc to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      } else if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // Focus input when modal opens
  useEffect(() => {
    if (open) inputRef.current?.focus()
    if (!open) {
      setQuery('')
      setSelectedIndex(0)
      setResults([])
    }
  }, [open])

  // Clamp selected index when results change
  useEffect(() => {
    if (selectedIndex >= results.length) setSelectedIndex(0)
  }, [results.length, selectedIndex])

  const navigate = useCallback(
    (url: string) => {
      setOpen(false)
      router.push(url)
    },
    [router],
  )

  const onInputKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, Math.max(0, results.length - 1)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      const target = results[selectedIndex]
      if (target) {
        e.preventDefault()
        navigate(target.url)
      }
    }
  }

  // Scroll selected into view
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const selected = list.children[selectedIndex] as HTMLElement | undefined
    selected?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open search"
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
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
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
          role="dialog"
          aria-label="Search"
          aria-modal="true"
          onClick={() => setOpen(false)}
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
            onClick={(e) => e.stopPropagation()}
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
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onInputKey}
                placeholder="Search docs…"
                aria-label="Search query"
                style={{
                  flex: 1,
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  color: 'var(--fg)',
                  fontSize: '0.9375rem',
                  fontFamily: 'inherit',
                }}
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
                  {query.trim() ? `No results for "${query}"` : 'Type to search.'}
                </li>
              )}
              {results.map((r, i) => (
                <li
                  key={r.url}
                  role="option"
                  aria-selected={i === selectedIndex}
                  onMouseEnter={() => setSelectedIndex(i)}
                  onClick={() => navigate(r.url)}
                  style={{
                    padding: '0.625rem 1rem',
                    cursor: 'pointer',
                    background: i === selectedIndex ? 'var(--bg-muted)' : 'transparent',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <div style={{ fontWeight: 500, color: 'var(--fg)' }}>{r.title}</div>
                  <div
                    style={{
                      fontSize: '0.8125rem',
                      color: 'var(--fg-muted)',
                      marginTop: '0.25rem',
                      lineHeight: 1.4,
                    }}
                    // Pagefind excerpts contain sanitized HTML with <mark>.
                    // Fallback excerpts are plain text (no HTML in our
                    // descriptions). Both render safely via innerHTML.
                    dangerouslySetInnerHTML={{ __html: r.excerpt }}
                  />
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  )
}

function SearchIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M11 11L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

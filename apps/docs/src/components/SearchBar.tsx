'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

interface SearchDoc {
  url: string
  title: string
  description: string
  section: string
  headings: string[]
  tags: string[]
}

function prettifySection(s: string): string {
  return s
    .split('.')
    .map((p) => (p.length > 0 ? p[0]!.toUpperCase() + p.slice(1) : p))
    .join(' ')
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

export function SearchBar() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [docs, setDocs] = useState<SearchDoc[] | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  // Lazy-load the search index on first open
  useEffect(() => {
    if (open && docs === null) {
      fetch('/api/search')
        .then((r) => r.json())
        .then((data: SearchDoc[]) => setDocs(data))
        .catch((err) => {
          console.error('search: failed to load index', err)
          setDocs([])
        })
    }
  }, [open, docs])

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
    }
  }, [open])

  const q = query.toLowerCase().trim()
  const results = !docs
    ? []
    : (q ? docs.filter((d) => matches(d, q)) : docs).slice(0, 20)

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
              {docs === null && (
                <li
                  style={{
                    padding: '1rem',
                    color: 'var(--fg-muted)',
                    fontSize: '0.875rem',
                  }}
                >
                  Loading…
                </li>
              )}
              {docs !== null && results.length === 0 && (
                <li
                  style={{
                    padding: '1rem',
                    color: 'var(--fg-muted)',
                    fontSize: '0.875rem',
                  }}
                >
                  {q ? `No results for "${query}"` : 'Type to search.'}
                </li>
              )}
              {results.map((doc, i) => (
                <li
                  key={doc.url}
                  role="option"
                  aria-selected={i === selectedIndex}
                  onMouseEnter={() => setSelectedIndex(i)}
                  onClick={() => navigate(doc.url)}
                  style={{
                    padding: '0.625rem 1rem',
                    cursor: 'pointer',
                    background:
                      i === selectedIndex ? 'var(--bg-muted)' : 'transparent',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      justifyContent: 'space-between',
                      gap: '0.75rem',
                    }}
                  >
                    <span style={{ fontWeight: 500, color: 'var(--fg)' }}>
                      {doc.title}
                    </span>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        color: 'var(--fg-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {prettifySection(doc.section)}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: '0.8125rem',
                      color: 'var(--fg-muted)',
                      marginTop: '0.25rem',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {doc.description}
                  </div>
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
      <path
        d="M11 11L14 14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

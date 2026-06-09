import type { DocsHeading } from '@/content/types';

export function TableOfContents({ headings }: { headings: DocsHeading[] }) {
  if (headings.length === 0) return null;

  return (
    <nav
      aria-label="On this page"
      data-pagefind-ignore="all"
      style={{
        position: 'sticky',
        top: '4rem',
        alignSelf: 'start',
        maxHeight: 'calc(100vh - 5rem)',
        overflowY: 'auto',
        fontSize: '0.8125rem',
      }}
    >
      <div
        style={{
          fontSize: '0.7rem',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'var(--fg-muted)',
          fontWeight: 600,
          marginBottom: '0.5rem',
        }}
      >
        On this page
      </div>
      <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {headings.map((h) => (
          <li
            key={h.id}
            style={{
              paddingLeft: h.depth === 3 ? '0.75rem' : 0,
              lineHeight: 1.5,
              marginBottom: '0.25rem',
            }}
          >
            <a
              href={`#${h.id}`}
              style={{
                color: 'var(--fg-muted)',
                textDecoration: 'none',
              }}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

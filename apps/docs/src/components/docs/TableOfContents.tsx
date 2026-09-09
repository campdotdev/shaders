import { ScrollArea } from '@/components/scroll-area/scroll-area';
import type { DocsHeading } from '@/content/types';

// The guide pages' "On this page" list, sticky beside the article. The
// nav's height cap flows into the shared ScrollArea, which scrolls the list
// once it outgrows the viewport.
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
        fontSize: '0.8125rem',
      }}
    >
      <ScrollArea>
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
          {headings.map((heading) => (
            <li
              key={heading.id}
              style={{
                paddingLeft: heading.depth === 3 ? '0.75rem' : 0,
                lineHeight: 1.5,
                marginBottom: '0.25rem',
              }}
            >
              <a
                href={`#${heading.id}`}
                style={{
                  color: 'var(--fg-muted)',
                  textDecoration: 'none',
                }}
              >
                {heading.text}
              </a>
            </li>
          ))}
        </ol>
      </ScrollArea>
    </nav>
  );
}

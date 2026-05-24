import Link from 'next/link'
import type { DocsBreadcrumb } from '@/content/types'

export function Breadcrumbs({ crumbs }: { crumbs: DocsBreadcrumb[] }) {
  if (crumbs.length === 0) return null
  return (
    <nav
      aria-label="Breadcrumb"
      style={{
        fontSize: '0.8125rem',
        color: 'var(--fg-muted)',
        marginBottom: '1.5rem',
      }}
    >
      {crumbs.map((c, i) => (
        <span key={`${i}-${c.label}`}>
          {i > 0 && (
            <span style={{ margin: '0 0.5rem', opacity: 0.5 }} aria-hidden>
              /
            </span>
          )}
          {c.url ? (
            <Link href={c.url} style={{ color: 'var(--fg-muted)' }}>
              {c.label}
            </Link>
          ) : (
            <span>{c.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}

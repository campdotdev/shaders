import Link from 'next/link'
import type { DocsNeighbor } from '@/content/types'

const cardStyle = {
  display: 'block',
  padding: '0.875rem 1rem',
  border: '1px solid var(--border)',
  borderRadius: '0.5rem',
  color: 'var(--fg)',
  textDecoration: 'none',
} as const

const labelStyle = {
  display: 'block',
  fontSize: '0.7rem',
  color: 'var(--fg-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginBottom: '0.25rem',
} as const

const titleStyle = {
  display: 'block',
  fontWeight: 500,
  fontSize: '0.9375rem',
} as const

export function PrevNext({
  prev,
  next,
}: {
  prev: DocsNeighbor | null
  next: DocsNeighbor | null
}) {
  if (!prev && !next) return null
  return (
    <nav
      aria-label="Previous and next page"
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '1rem',
        marginTop: '3rem',
        paddingTop: '1.5rem',
        borderTop: '1px solid var(--border)',
      }}
    >
      {prev ? (
        <Link href={prev.url} style={cardStyle}>
          <span style={labelStyle}>&larr; Previous</span>
          <span style={titleStyle}>{prev.label}</span>
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link href={next.url} style={{ ...cardStyle, textAlign: 'right' }}>
          <span style={labelStyle}>Next &rarr;</span>
          <span style={titleStyle}>{next.label}</span>
        </Link>
      ) : (
        <span />
      )}
    </nav>
  )
}

import Link from 'next/link'
import { PRIMITIVES } from '../_data/primitives'

// Server Component — static index of all documented Tier 2 primitives.

export default function PrimitivesIndex() {
  return (
    <div style={{ padding: '2rem 1.5rem', maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ marginTop: 0 }}>Primitives</h1>
      <p style={{ color: 'var(--fg-muted)' }}>
        Tier 2 — pure TSL functions exported from <code>@lovo/matter</code>. Use them
        inside your own shaders or compose them into Tier 1 components.
      </p>
      <ul style={{ paddingLeft: '1.25rem', lineHeight: 1.8 }}>
        {PRIMITIVES.map((p) => (
          <li key={p.slug}>
            <Link href={`/primitives/${p.slug}`}>{p.name}</Link>
            <span
              style={{
                color: 'var(--fg-muted)',
                marginLeft: '0.5rem',
                fontSize: '0.85rem',
              }}
            >
              — {p.description}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

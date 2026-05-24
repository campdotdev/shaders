import Link from 'next/link'
import { RECIPES } from '@/data/recipes'

// Server Component — static index of all Tier 3 recipes.

export default function RecipesIndex() {
  return (
    <div style={{ padding: '2rem 1.5rem', maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ marginTop: 0 }}>Recipes</h1>
      <p style={{ color: 'var(--fg-muted)' }}>
        Tier 3 — short TSL snippets that combine{' '}
        {/* textDecoration ensures the link is distinguishable without relying
            on color alone (WCAG 1.4.1 / axe link-in-text-block rule). */}
        <Link href="/primitives" style={{ textDecoration: 'underline' }}>
          primitives
        </Link>
        . Copy-paste into your own component.
      </p>
      <ul style={{ paddingLeft: '1.25rem', lineHeight: 1.8 }}>
        {RECIPES.map((r) => (
          <li key={r.slug}>
            <Link href={`/recipes/${r.slug}`}>{r.name}</Link>
            <span
              style={{
                color: 'var(--fg-muted)',
                marginLeft: '0.5rem',
                fontSize: '0.85rem',
              }}
            >
              — {r.description}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

import Link from 'next/link';

import { RECIPES } from '@/data/recipes';

export default function RecipesIndex() {
  return (
    <div style={{ padding: '2rem 1.5rem', maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ marginTop: 0 }}>Recipes</h1>
      <p style={{ color: 'var(--fg-muted)' }}>
        Tier 3 — short TSL snippets that combine{' '}
        <Link href="/primitives" style={{ textDecoration: 'underline' }}>
          primitives
        </Link>
        . Copy-paste into your own component.
      </p>
      <ul style={{ paddingLeft: '1.25rem', lineHeight: 1.8 }}>
        {RECIPES.map((r) => (
          <li key={r.slug}>
            {/* Underlined for axe's link-in-text-block rule: on the dark palette
                the lime link is under 3:1 against the muted text beside it, so
                color alone cannot mark it as a link. Same fix as the primitives
                link above. */}
            <Link href={`/recipes/${r.slug}`} style={{ textDecoration: 'underline' }}>
              {r.name}
            </Link>
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
  );
}

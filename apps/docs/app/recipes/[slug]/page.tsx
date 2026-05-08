import { notFound } from 'next/navigation'
import Link from 'next/link'
import { CodeBlock } from '../../_components/CodeBlock'
import { RecipeViewer } from '../../_components/RecipeViewer'
import { RECIPES } from '../../_data/recipes'

// Server Component — generates one static route per recipe at build time.
// Each /recipes/<slug> renders ONE canonical source block (the user
// copy-pastes this) plus a grid of 2-3 variant preview cards demonstrating
// different parameterizations. Each card's `note` describes the one-line
// modification that produces that variant from the canonical source.
//
// RecipeViewer is itself a Client Component that dynamic-imports the actual
// three/webgpu scene with ssr:false (Next 15 disallows ssr:false in Server
// Components, so the dynamic-import wrapper has to live one layer down).

export function generateStaticParams() {
  return RECIPES.map((r) => ({ slug: r.slug }))
}

interface RecipePageProps {
  // Next 15: dynamic-route params is a Promise.
  params: Promise<{ slug: string }>
}

export default async function RecipePage({ params }: RecipePageProps) {
  const { slug } = await params
  const recipe = RECIPES.find((r) => r.slug === slug)
  if (!recipe) notFound()

  // The first variant is canonical and matches recipe.source verbatim. We
  // render it as the main preview at the top so the page still feels like
  // it leads with a hero, then the variant grid below shows the spread.
  // The data file guarantees >= 1 variant per recipe; the explicit guard
  // is for TS's noUncheckedIndexedAccess.
  const canonicalVariant = recipe.variants[0]
  if (!canonicalVariant) notFound()

  return (
    <div style={{ padding: '2rem 1.5rem', maxWidth: 900, margin: '0 auto' }}>
      <p style={{ color: 'var(--fg-muted)', marginTop: 0 }}>
        <Link href="/recipes">recipes</Link> / {recipe.slug}
      </p>
      <h1 style={{ marginTop: 0 }}>{recipe.name}</h1>
      <p style={{ color: 'var(--fg-muted)' }}>{recipe.description}</p>

      <RecipeViewer slug={recipe.slug} variant={canonicalVariant.key} />

      <h2 style={{ marginTop: '2rem', fontSize: '1rem' }}>Source</h2>
      <CodeBlock source={recipe.source} lang="tsx" />

      {recipe.variants.length > 1 && (
        <section style={{ marginTop: '2rem' }}>
          <h2 style={{ fontSize: '1rem', marginBottom: '0.25rem' }}>Variants</h2>
          <p style={{ color: 'var(--fg-muted)', marginTop: 0, fontSize: '0.9rem' }}>
            Same recipe, different parameters. Each card&apos;s caption
            describes the one-line change to the source above.
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '1rem',
              marginTop: '1rem',
            }}
          >
            {recipe.variants.map((v) => (
              <article
                key={v.key}
                style={{
                  padding: '0.75rem',
                  background: 'var(--bg-muted)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                }}
              >
                <div
                  style={{
                    position: 'relative',
                    height: 200,
                    background: '#0a0a14',
                    borderRadius: 6,
                    overflow: 'hidden',
                    marginBottom: '0.5rem',
                  }}
                >
                  <RecipeViewer slug={recipe.slug} variant={v.key} unframed />
                </div>
                <h3 style={{ fontSize: '0.95rem', margin: 0 }}>{v.label}</h3>
                <p
                  style={{
                    fontSize: '0.85rem',
                    color: 'var(--fg-muted)',
                    margin: '0.25rem 0 0 0',
                  }}
                >
                  {v.note}
                </p>
              </article>
            ))}
          </div>
        </section>
      )}

      {recipe.primitivesUsed.length > 0 && (
        <>
          <h2 style={{ marginTop: '2rem', fontSize: '1rem' }}>Primitives used</h2>
          <ul>
            {recipe.primitivesUsed.map((pslug) => (
              <li key={pslug}>
                <Link href={`/primitives/${pslug}`}>{pslug}</Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

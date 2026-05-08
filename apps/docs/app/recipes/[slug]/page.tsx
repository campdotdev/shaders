import { notFound } from 'next/navigation'
import Link from 'next/link'
import { CodeBlock } from '../../_components/CodeBlock'
import { RecipeViewer } from '../../_components/RecipeViewer'
import { RECIPES } from '../../_data/recipes'

// Server Component — generates one static route per recipe at build time.
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

  return (
    <div style={{ padding: '2rem 1.5rem', maxWidth: 900, margin: '0 auto' }}>
      <p style={{ color: 'var(--fg-muted)', marginTop: 0 }}>
        <Link href="/recipes">recipes</Link> / {recipe.slug}
      </p>
      <h1 style={{ marginTop: 0 }}>{recipe.name}</h1>
      <p style={{ color: 'var(--fg-muted)' }}>{recipe.description}</p>

      <RecipeViewer slug={recipe.slug} />

      <h2 style={{ marginTop: '2rem', fontSize: '1rem' }}>Source</h2>
      <CodeBlock source={recipe.source} lang="tsx" />

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

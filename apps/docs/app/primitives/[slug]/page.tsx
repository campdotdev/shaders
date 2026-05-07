import { notFound } from 'next/navigation'
import Link from 'next/link'
import { CodeBlock } from '../../_components/CodeBlock'
import { PrimitiveDemo } from '../../_components/PrimitiveDemo'
import { PRIMITIVES } from '../../_data/primitives'

// Server Component — generates one static route per primitive at build time
// and renders the page chrome (signature CodeBlock, cross-links). The
// interactive demo is a Client child (PrimitiveDemo).

export function generateStaticParams() {
  return PRIMITIVES.map((p) => ({ slug: p.slug }))
}

interface PrimitivePageProps {
  // Next 15: dynamic-route params is a Promise.
  params: Promise<{ slug: string }>
}

export default async function PrimitivePage({ params }: PrimitivePageProps) {
  const { slug } = await params
  const prim = PRIMITIVES.find((p) => p.slug === slug)
  if (!prim) notFound()

  return (
    <div style={{ padding: '2rem 1.5rem', maxWidth: 900, margin: '0 auto' }}>
      <p style={{ color: 'var(--fg-muted)', marginTop: 0 }}>
        <Link href="/primitives">primitives</Link> / {prim.slug}
      </p>
      <h1 style={{ marginTop: 0 }}>{prim.name}()</h1>
      <p style={{ color: 'var(--fg-muted)' }}>{prim.description}</p>

      <PrimitiveDemo slug={prim.slug} controls={prim.controls} />

      <h2 style={{ marginTop: '2rem', fontSize: '1rem' }}>Signature</h2>
      <CodeBlock source={prim.signature} lang="ts" />

      {prim.usedBy.length > 0 && (
        <>
          <h2 style={{ marginTop: '2rem', fontSize: '1rem' }}>Used by</h2>
          <ul>
            {prim.usedBy.map((cslug) => (
              <li key={cslug}>
                <Link href={`/components/${cslug}`}>&lt;{cslug}&gt;</Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

import Link from 'next/link';
import { notFound } from 'next/navigation';

import { CodeBlock } from '@/components/code-block/code-block';
import { PrimitiveDemo } from '@/components/PrimitiveDemo';
import { PRIMITIVES } from '@/data/primitives';

export function generateStaticParams() {
  return PRIMITIVES.map((p) => ({ slug: p.slug }));
}

interface PrimitivePageProps {
  params: Promise<{ slug: string }>;
}

export default async function PrimitivePage({ params }: PrimitivePageProps) {
  const { slug } = await params;
  const prim = PRIMITIVES.find((p) => p.slug === slug);

  if (!prim) notFound();

  return (
    <div style={{ padding: '2rem 1.5rem', maxWidth: 900, margin: '0 auto' }}>
      <p style={{ color: 'var(--fg-muted)', marginTop: 0 }}>
        <Link href="/primitives">primitives</Link> / {prim.slug}
      </p>
      <h1 style={{ marginTop: 0 }}>{prim.name}()</h1>
      <p style={{ color: 'var(--fg-muted)' }}>{prim.description}</p>
      <PrimitiveDemo controls={prim.controls} slug={prim.slug} />
      <h2 style={{ marginTop: '2rem', fontSize: '1rem' }}>Signature</h2>
      <CodeBlock lang="ts" source={prim.signature} />
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
  );
}

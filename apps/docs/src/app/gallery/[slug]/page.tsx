/**
 * One composition's page at /gallery/<slug>: its title, description, and
 * Copy React over the composition and its Customize panel in the demo
 * layout. The registry (compositions/index.ts) supplies the static params
 * and every word on the page. The library defaults for each entry's
 * component are read here, at build, because props.ts reads the component
 * sources from disk, and the island seeds its store from them.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { CopySourceProvider } from '@/components/controls';
import { PageActions } from '@/components/page-actions/page-actions';
import { COMPOSITIONS, findComposition } from '@/compositions';
import { readCompositionDefaults } from '@/compositions/read-defaults';

// The component pages' header styles, so the two kinds of page share one
// header until the author designs the Gallery.
import styles from '../../components/[slug]/page.module.css';
import { CompositionIsland } from './composition-island';

export const dynamicParams = false;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return COMPOSITIONS.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const composition = findComposition((await params).slug);

  if (!composition) return {};

  return { title: composition.title, description: composition.description };
}

export default async function CompositionPage({ params }: PageProps) {
  const composition = findComposition((await params).slug);

  if (!composition) notFound();

  const defaults = await readCompositionDefaults(composition);

  return (
    <article>
      {/* The header's Copy React reads the island's store through this
          provider; see the copy source in controls/context.tsx. */}
      <CopySourceProvider>
        <header className={styles.header}>
          <div className={styles.heading}>
            <h1 className={styles.title}>{composition.title}</h1>
            <p className={styles.description}>{composition.description}</p>
          </div>
          <PageActions target={{ kind: 'composition', composition, defaults }} />
        </header>
        <CompositionIsland composition={composition} defaults={defaults} />
      </CopySourceProvider>
    </article>
  );
}

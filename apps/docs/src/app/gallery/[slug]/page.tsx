/**
 * One composition's page at /gallery/<slug>: its title and description over
 * the composition in the demo layout. The registry (compositions/index.ts)
 * supplies the static params and every word on the page, and the island
 * draws the scene on the client.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { COMPOSITIONS, findComposition } from '@/compositions';

import { CompositionIsland } from './composition-island';
import styles from './page.module.css';

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

  return (
    <article>
      <header className={styles.header}>
        <h1 className={styles.title}>{composition.title}</h1>
        <p className={styles.description}>{composition.description}</p>
      </header>
      <CompositionIsland composition={composition} />
    </article>
  );
}

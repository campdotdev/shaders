/**
 * One composition's page at /gallery/<slug>: its title and description over
 * the composition and its Customize panel in the demo layout. The registry
 * (compositions/index.ts) supplies the static params and every word on the
 * page. The library defaults for each entry's component are read here, at
 * build, because props.ts reads the component sources from disk, and the
 * island seeds its store from them.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { COMPOSITIONS, findComposition } from '@/compositions';
import type { Composition } from '@/compositions/define';
import type { CompositionDefaults } from '@/compositions/store';
import { slugForComponentName } from '@/content/catalog';
import { getComponentDefaults } from '@/content/props';

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
      <CompositionIsland composition={composition} defaults={await readDefaults(composition)} />
    </article>
  );
}

/** The library defaults for each stack entry's component, keyed by entry id. */
async function readDefaults(composition: Composition): Promise<CompositionDefaults> {
  return Object.fromEntries(
    await Promise.all(
      composition.stack.map(async ({ id, component }) => {
        const slug = slugForComponentName(component);

        if (slug === undefined) throw new Error(`No component page for ${component}`);

        return [id, await getComponentDefaults(slug)] as const;
      }),
    ),
  );
}

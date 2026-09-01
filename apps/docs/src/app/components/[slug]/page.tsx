/**
 * Shared shell for every converted component page, in the mock's section
 * order: header above the demo, Usage and API Reference below it, then
 * prev/next pagination. Titles, descriptions, and page order come from the
 * catalog (registry.json); the interactive demo and Usage content come from
 * the demo registry, which every component page has an entry in.
 * Rendering waits on that entry, so a new component joins the site by
 * registering its demo island here rather than by adding a page file.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getComponentsCatalog } from '@/content/catalog';

import { COMPONENT_PAGES } from '../demo-registry';
import styles from './page.module.css';

export const dynamicParams = false;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return Object.keys(COMPONENT_PAGES).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const record = (await getComponentsCatalog()).find((c) => c.url === `/components/${slug}`);

  if (!record) return {};

  return { title: record.label, description: record.description };
}

export default async function ComponentPage({ params }: PageProps) {
  const { slug } = await params;
  const entry = COMPONENT_PAGES[slug];
  const catalog = await getComponentsCatalog();
  const record = catalog.find((c) => c.url === `/components/${slug}`);

  if (!entry || !record) notFound();

  const index = catalog.indexOf(record);
  const previous = catalog[index - 1] ?? null;
  const next = catalog[index + 1] ?? null;
  const Island = entry.Island;

  return (
    <main>
      <header className={styles.header}>
        <h1 className={styles.title}>{record.label}</h1>
        <p className={styles.description}>{record.description}</p>
      </header>
      <Island />
      <div className={styles.sections}>
        <section>
          <h2 className={styles.sectionTitle}>Usage</h2>
          {entry.usageNotes === undefined ? null : (
            <div className={styles.prose}>{entry.usageNotes}</div>
          )}
          <pre className={styles.snippet}>{entry.usageSnippet}</pre>
        </section>
        <section>
          <h2 className={styles.sectionTitle}>API Reference</h2>
          <p className={styles.prose}>Customize the shader with the following props.</p>
        </section>
        <nav aria-label="Component pages" className={styles.pagination}>
          {previous ? (
            <Link className={styles.paginationLink} href={previous.url}>
              {previous.label}
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link className={styles.paginationLink} href={next.url}>
              {next.label}
            </Link>
          ) : (
            <span />
          )}
        </nav>
      </div>
    </main>
  );
}

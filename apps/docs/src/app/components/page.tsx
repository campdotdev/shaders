import Link from 'next/link';

import { Breadcrumbs } from '@/components/breadcrumbs/breadcrumbs';
import { getComponentsCatalog } from '@/content/catalog';
import { DOCS_TRAIL_ROOT } from '@/content/nav';
import type { DocsBreadcrumb } from '@/content/types';

import styles from './page.module.css';

export const metadata = {
  title: 'Components',
  description: 'Tier 1 shader components, imported from @camp-dev/shaders and tuned through props.',
};

const crumbs: DocsBreadcrumb[] = [...DOCS_TRAIL_ROOT, { label: 'Components', url: '/components' }];

export default async function ComponentsIndex() {
  const components = await getComponentsCatalog();

  return (
    <article style={{ lineHeight: 1.65 }}>
      <Breadcrumbs className={styles.breadcrumbs} crumbs={crumbs} />
      <h1 style={{ marginTop: 0 }}>Components</h1>
      <p style={{ color: 'var(--fg-muted)' }}>
        Tier 1: polished shader components, imported from <code>@camp-dev/shaders</code> and tuned
        through props. Each page below has a live demo, a props playground, and the usage snippet to
        paste into your app.
      </p>
      <ul style={{ paddingLeft: '1.25rem', lineHeight: 1.8 }}>
        {components.map((c) => (
          <li key={c.url}>
            <Link href={c.url}>{c.label}</Link>
            <span
              style={{
                color: 'var(--fg-muted)',
                marginLeft: '0.5rem',
                fontSize: '0.85rem',
              }}
            >
              — {c.description}
            </span>
          </li>
        ))}
      </ul>
    </article>
  );
}

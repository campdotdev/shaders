import Link from 'next/link';

import { getComponentsCatalog } from '@/content/catalog';

export const metadata = {
  title: 'Components',
  description: 'Tier 1 shader components delivered shadcn-style via shaders-cli add <name>.',
};

export default async function ComponentsIndex() {
  const components = await getComponentsCatalog();

  return (
    <article style={{ lineHeight: 1.65 }}>
      <h1 style={{ marginTop: 0 }}>Components</h1>
      <p style={{ color: 'var(--fg-muted)' }}>
        Tier 1 — polished shader components delivered shadcn-style via{' '}
        <code>shaders-cli add &lt;name&gt;</code>. Each component is yours to edit after copy-in.
        Each page below has a live demo, a props playground, and the byte-identical source the CLI
        copies into your project.
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

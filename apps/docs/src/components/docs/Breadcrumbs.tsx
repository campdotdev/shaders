import Link from 'next/link';

import type { DocsBreadcrumb } from '@/content/types';

export function Breadcrumbs({ crumbs }: { crumbs: DocsBreadcrumb[] }) {
  if (crumbs.length === 0) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      data-pagefind-ignore="all"
      style={{
        fontSize: '0.8125rem',
        color: 'var(--fg-muted)',
        marginBottom: '1.5rem',
      }}
    >
      {crumbs.map((crumb, index) => (
        // Positional keys are safe here: the trail is server-rendered once
        // per page, never reorders or filters, and the rows hold no state —
        // the reordered-form hazard the rule guards against cannot occur.
        // react-doctor-disable-next-line react-doctor/no-array-index-as-key
        <span key={`${index}-${crumb.label}`}>
          {index > 0 && (
            <span aria-hidden style={{ margin: '0 0.5rem', opacity: 0.5 }}>
              /
            </span>
          )}
          {crumb.url !== null && crumb.url !== '' ? (
            <Link href={crumb.url} style={{ color: 'var(--fg-muted)' }}>
              {crumb.label}
            </Link>
          ) : (
            <span>{crumb.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

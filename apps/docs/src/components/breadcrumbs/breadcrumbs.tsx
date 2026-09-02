/**
 * Breadcrumb trail for the docs pages, after the Figma mock: muted links
 * separated by pixel triangles, with the current page last, in lime,
 * and not linked. The MDX route derives its trail from the nav tree in
 * content/nav.ts and the component page template hands over a fixed
 * four-entry trail, but both pass the same DocsBreadcrumb shape, so this
 * file owns the look for every page.
 */
import Link from 'next/link';

import { CaretRightIcon } from '@/components/icons/caret-right';
import type { DocsBreadcrumb } from '@/content/types';

import styles from './breadcrumbs.module.css';

interface BreadcrumbsProps {
  /** Trail from the site root to the current page, with the current page last. */
  crumbs: DocsBreadcrumb[];
  /** Positions the nav from the page; the nav carries no outer margin of its own. */
  className?: string;
}

export function Breadcrumbs({ crumbs, className }: BreadcrumbsProps) {
  if (crumbs.length === 0) return null;

  const last = crumbs.length - 1;

  return (
    <nav aria-label="Breadcrumb" className={className} data-pagefind-ignore="all">
      <ol className={styles.list}>
        {crumbs.map((crumb, index) => (
          // Positional keys are safe here: the trail is server-rendered once
          // per page, never reorders or filters, and the rows hold no state —
          // the reordered-form hazard the rule guards against cannot occur.
          // react-doctor-disable-next-line react-doctor/no-array-index-as-key
          <li className={styles.crumb} key={`${index}-${crumb.label}`}>
            {index === last ? (
              <span aria-current="page" className={styles.current}>
                {crumb.label}
              </span>
            ) : (
              <Ancestor crumb={crumb} />
            )}
            {index < last && <CaretRightIcon className={styles.separator} />}
          </li>
        ))}
      </ol>
    </nav>
  );
}

// Every crumb before the current page: a link when the trail has a URL for
// it, plain text for a grouping such as "Documentation" that has no page.
function Ancestor({ crumb }: { crumb: DocsBreadcrumb }) {
  if (crumb.url === null || crumb.url === '') {
    return <span className={styles.label}>{crumb.label}</span>;
  }

  return (
    <Link className={styles.link} href={crumb.url}>
      {crumb.label}
    </Link>
  );
}

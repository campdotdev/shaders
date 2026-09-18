/**
 * The prev and next links at the foot of a docs page, after the Figma
 * mock's `pagination` frame: two buttons that point their chevron outward,
 * the previous one glyph first and the next one label first. Both page
 * types render it — the component template (app/components/[slug]) pages
 * through the taxonomy order and the MDX route (app/(docs-content)) through
 * the nav tree — and both hand over the same DocsNeighbor shape, so this
 * file owns the look for every page.
 */
import Link from 'next/link';

import { ChevronDownIcon } from '@/components/icons/chevron-down';
import type { DocsNeighbor } from '@/content/types';

import styles from './pagination.module.css';

interface PaginationProps {
  /** The page before this one in its section, or null at the start of one. */
  prev: DocsNeighbor | null;
  /** The page after this one in its section, or null at the end of one. */
  next: DocsNeighbor | null;
  /** Positions the nav from the page; the nav carries no outer margin of its own. */
  className?: string;
}

export function Pagination({ prev, next, className }: PaginationProps) {
  if (!prev && !next) return null;

  return (
    <nav
      aria-label="Previous and next page"
      className={join(styles.pagination, className)}
      data-pagefind-ignore="all"
    >
      {/* The empty spans hold the row's two ends apart: without one, the
          single button on a section's first or last page would slide over
          to the side it does not belong on. */}
      {prev ? (
        <Link className={styles.link} href={prev.url}>
          <ChevronDownIcon className={styles.chevronPrevious} />
          {prev.label}
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link className={styles.link} href={next.url}>
          {next.label}
          <ChevronDownIcon className={styles.chevronNext} />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

function join(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(' ');
}

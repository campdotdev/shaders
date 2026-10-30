/**
 * The "Used in" strip on a component's reference page: one compact row of
 * the compositions whose stack includes the component, each a thumbnail and
 * a title linking to its Gallery page. Provisional: the author judges it on
 * the dev server, then keeps it, redesigns it, or drops it, so it stays one
 * small server component with no client code. It renders nothing when no
 * composition uses the component.
 */
import Image from 'next/image';
import Link from 'next/link';
import { useId } from 'react';

import type { Composition } from '@/compositions/define';
import { compositionThumbnail } from '@/compositions/posters';

import styles from './used-in.module.css';

// The thumbnail's edge in CSS pixels. scripts/build-thumbnail.mjs cuts it at
// 124px, twice this, for a 2x screen.
const THUMBNAIL_SIZE = 40;

export function UsedIn({ compositions }: { compositions: readonly Composition[] }) {
  const headingId = useId();

  if (compositions.length === 0) return null;

  return (
    <section aria-labelledby={headingId} className={styles.strip}>
      <h2 className={styles.heading} id={headingId}>
        Used in
      </h2>
      <ul className={styles.list}>
        {compositions.map(({ slug, title }) => (
          <li key={slug}>
            <Link className={styles.item} href={`/gallery/${slug}`}>
              <Image
                alt=""
                className={styles.thumbnail}
                height={THUMBNAIL_SIZE}
                src={compositionThumbnail(slug)}
                width={THUMBNAIL_SIZE}
              />
              {title}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

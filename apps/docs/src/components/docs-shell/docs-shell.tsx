/**
 * The two-column frame under the section banner: the docs sidebar on the
 * left and the page on the right, in the page gutter and 9xl container that
 * globals.css defines. The three docs layouts (components, primitives, and
 * the MDX content) all render it. Column widths follow the Figma mock: a
 * 2xs sidebar with no gap, then a main column that insets its own content
 * by 40px.
 */
import type { ReactNode } from 'react';

import { DocsSidebar } from '@/components/docs/DocsSidebar';
import { getDocsNavTree } from '@/content/nav';

import styles from './docs-shell.module.css';

export async function DocsShell({ children }: { children: ReactNode }) {
  const tree = await getDocsNavTree();

  return (
    <div className="site-gutter">
      <div className={`site-container ${styles.shell}`}>
        <DocsSidebar tree={tree} />
        <div className={styles.main}>{children}</div>
      </div>
    </div>
  );
}

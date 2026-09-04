/**
 * The two-column frame under the section banner: the docs sidebar on the
 * left and the page on the right, in the page gutter and 9xl container that
 * globals.css defines. The three docs layouts (components, primitives, and
 * the MDX content) each render it with their own section, and the sidebar
 * shows only that section's groups. Column widths follow the Figma mock: a
 * 2xs sidebar with no gap, then a main column that insets its own content
 * by 40px.
 */
import type { ReactNode } from 'react';

import { DocsSidebar } from '@/components/docs/DocsSidebar';
import { getDocsSidebarTree } from '@/content/nav';
import type { SidebarSection } from '@/content/types';

import styles from './docs-shell.module.css';

interface DocsShellProps {
  /** Which nav section's groups the sidebar shows. */
  section: SidebarSection;
  children: ReactNode;
}

export async function DocsShell({ section, children }: DocsShellProps) {
  const tree = await getDocsSidebarTree(section);

  return (
    <div className="site-gutter">
      <div className={`site-container ${styles.shell}`}>
        <DocsSidebar tree={tree} />
        <div className={styles.main}>{children}</div>
      </div>
    </div>
  );
}

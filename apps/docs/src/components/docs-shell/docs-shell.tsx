/**
 * The two-column frame under the section banner: the docs sidebar on the
 * left and the page on the right, in the page gutter and 9xl container that
 * globals.css defines. The two docs layouts (components and the MDX
 * content) each render it with their own section, and the sidebar shows
 * only that section's groups. Column widths follow the Figma mock: a
 * 2xs sidebar with no gap, then a main column whose content wrapper carries
 * a 40px inset until the demo grid stacks (docs-shell.module.css). Under
 * 48rem of the site container the sidebar column goes and the same tree
 * renders as a dropdown at the top of that wrapper; both are always in the
 * tree and CSS decides which shows.
 */
import type { ReactNode } from 'react';

import { DocsNavDropdown } from '@/components/docs-nav-dropdown/docs-nav-dropdown';
import { DocsSidebar } from '@/components/docs-sidebar/docs-sidebar';
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
        <div className={styles.main}>
          <div className={styles.content}>
            {/* The components index has no row in its tree, so the trigger
                names the section instead. */}
            <DocsNavDropdown
              fallbackLabel={section === 'components' ? 'Components' : 'Documentation'}
              tree={tree}
            />
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

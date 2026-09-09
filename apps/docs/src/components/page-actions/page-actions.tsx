'use client';

/**
 * The split "Copy React" button in a component page's header, after the
 * Figma mock: a bordered box holding the copy action on the left and a
 * chevron cell on the right that opens a menu of three actions. Copy React
 * copies the demo's current props as JSX, and the two markdown rows copy
 * and open the page's markdown export (SHA-115). The shared
 * components/[slug] template renders it beside the title and description.
 * The menu is Base UI's Menu rather than the controls' Select, because the
 * rows are actions and not a value, but it borrows the select's popup
 * pattern: portaled, offset from its trigger, and scaled in from the edge
 * nearest it.
 */
import { Menu } from '@base-ui/react/menu';

import { ChevronDownIcon } from '@/components/icons/chevron-down';
import { CopyIcon } from '@/components/icons/copy';

import styles from './page-actions.module.css';

interface PageActionsProps {
  /** The component page's slug, which names its markdown export. */
  slug: string;
}

// The 12-unit copy glyph drawn on a 16px box, which is exactly the mock's
// 16px export of the same icon (every coordinate is the 12-unit path times
// four thirds).
const COPY_ICON_SIZE = 16;

export function PageActions({ slug }: PageActionsProps) {
  const markdownHref = `/components/${slug}/index.md`;

  return (
    <div className={styles.actions}>
      <button className={styles.copy} type="button">
        <CopyIcon height={COPY_ICON_SIZE} width={COPY_ICON_SIZE} />
        Copy React
      </button>
      <Menu.Root>
        <Menu.Trigger aria-label="More copy options" className={styles.more}>
          <ChevronDownIcon />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner align="end" side="bottom" sideOffset={8}>
            <Menu.Popup className={styles.popup}>
              <Menu.Item className={styles.row}>
                <span className={styles.rowTitle}>Copy React</span>
                <span className={styles.rowDescription}>Copy this component as React</span>
              </Menu.Item>
              <Menu.Item className={styles.row}>
                <span className={styles.rowTitle}>Copy as markdown</span>
                <span className={styles.rowDescription}>Copy this page as markdown for LLMs</span>
              </Menu.Item>
              <Menu.LinkItem
                className={styles.row}
                closeOnClick
                href={markdownHref}
                rel="noreferrer"
                target="_blank"
              >
                <span className={styles.rowTitle}>View as markdown</span>
                <span className={styles.rowDescription}>View this page as plain text</span>
              </Menu.LinkItem>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </div>
  );
}

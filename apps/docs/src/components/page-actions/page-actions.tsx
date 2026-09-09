'use client';

/**
 * The split "Copy React" button in a component page's header, after the
 * Figma mock: a bordered box holding the copy action on the left and a
 * chevron cell on the right that opens a menu of three actions. Copy React
 * copies the demo's current props as JSX, and the two markdown rows copy
 * and open the page's markdown export (SHA-115). The shared
 * components/[slug] template renders it beside the title and description,
 * inside the CopySourceProvider that the demo island publishes its control
 * store into (controls/context.tsx).
 * The menu is Base UI's Menu rather than the controls' Select, because the
 * rows are actions and not a value, but it borrows the select's popup
 * pattern: portaled, offset from its trigger, and scaled in from the edge
 * nearest it.
 */
import { Menu } from '@base-ui/react/menu';

import { formatJsx, useCopySource } from '@/components/controls';
import { CheckIcon } from '@/components/icons/check';
import { ChevronDownIcon } from '@/components/icons/chevron-down';
import { CopyIcon } from '@/components/icons/copy';
import { deriveUsageImport } from '@/lib/usage-import';
import { COPY_ANNOUNCEMENTS, useClipboardCopy } from '@/lib/use-clipboard-copy';

import styles from './page-actions.module.css';

interface PageActionsProps {
  /** The component page's slug, which names its markdown export. */
  slug: string;
  /** The component as written in JSX, e.g. 'WaveLines'. */
  componentName: string;
  /** Layers the demo renders under the component, as JSX, if any. */
  siblings?: readonly string[];
}

// The 12-unit copy glyph drawn on a 16px box, which is exactly the mock's
// 16px export of the same icon (every coordinate is the 12-unit path times
// four thirds).
const COPY_ICON_SIZE = 16;

export function PageActions({ slug, componentName, siblings }: PageActionsProps) {
  const store = useCopySource();
  const { status, copy } = useClipboardCopy();
  const markdownHref = `/components/${slug}/index.md`;

  // The demo as it stands right now: the import line for every tag in the
  // snippet, then the scene with the store's current params as props. Read
  // at click time rather than subscribed, so dragging a slider never
  // re-renders the header.
  const copyReact = () => {
    if (store === null) return;

    const jsx = formatJsx({ componentName, siblings }, store.getSnapshot());

    copy(`${deriveUsageImport(jsx)}\n\n${jsx}`);
  };

  return (
    <div className={styles.actions}>
      {/* Until the island mounts there is no store to read, and the button
          is disabled rather than copying nothing. */}
      <button
        className={styles.copy}
        data-copied={status === 'copied' || undefined}
        disabled={store === null}
        onClick={copyReact}
        type="button"
      >
        <span aria-hidden="true" className={styles.glyph}>
          <CopyIcon className={styles.copyGlyph} height={COPY_ICON_SIZE} width={COPY_ICON_SIZE} />
          <CheckIcon className={styles.checkGlyph} />
        </span>
        Copy React
      </button>
      <span aria-live="polite" className={styles.srOnly}>
        {COPY_ANNOUNCEMENTS[status]}
      </span>
      <Menu.Root>
        <Menu.Trigger aria-label="More copy options" className={styles.more}>
          <ChevronDownIcon />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner align="end" side="bottom" sideOffset={6}>
            <Menu.Popup className={styles.popup}>
              <Menu.Item className={styles.row} disabled={store === null} onClick={copyReact}>
                Copy React
              </Menu.Item>
              <Menu.Item className={styles.row}>Copy as markdown</Menu.Item>
              <Menu.LinkItem
                className={styles.row}
                closeOnClick
                href={markdownHref}
                rel="noreferrer"
                target="_blank"
              >
                View as markdown
              </Menu.LinkItem>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </div>
  );
}

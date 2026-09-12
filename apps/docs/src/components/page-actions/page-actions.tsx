'use client';

/**
 * The split "Copy React" button in a component page's header, after the
 * Figma mock: a bordered box holding the copy action on the left and a
 * chevron cell on the right that opens a menu of further actions. Copy
 * React copies the demo's current props as JSX. The menu's two rows read
 * the page's markdown export (app/md/[...slug]/route.ts): "Copy as
 * markdown" copies it and "View as markdown" opens it in a new tab. The
 * shared components/[slug] template renders it beside the title and
 * description, inside the CopySourceProvider that the demo island publishes
 * its control store into (controls/context.tsx).
 * The menu is Base UI's Menu rather than the controls' Select, because the
 * rows are actions and not a value, but it borrows the select's popup
 * pattern: portaled, offset from its trigger, and scaled in from the edge
 * nearest it.
 */
import { useRef, useState } from 'react';

import { Menu } from '@base-ui/react/menu';

import { formatJsx, useCopySource } from '@/components/controls';
import { CheckIcon } from '@/components/icons/check';
import { ChevronDownIcon } from '@/components/icons/chevron-down';
import { CopyIcon } from '@/components/icons/copy';
import { deriveUsageImport } from '@/lib/usage-import';
import { COPY_ANNOUNCEMENTS, useClipboardCopy } from '@/lib/use-clipboard-copy';

import styles from './page-actions.module.css';

interface PageActionsProps {
  /** The component as written in JSX, e.g. 'WaveLines'. */
  componentName: string;
  /** Layers the demo renders under the component, as JSX, if any. */
  siblings?: readonly string[];
  /** The page's markdown export, e.g. '/md/components/wave-lines.md'. */
  markdownUrl: string;
}

// The 12-unit copy glyph drawn on a 16px box, which is exactly the mock's
// 16px export of the same icon (every coordinate is the 12-unit path times
// four thirds).
const COPY_ICON_SIZE = 16;

export function PageActions({ componentName, siblings, markdownUrl }: PageActionsProps) {
  const store = useCopySource();
  const { status, copy } = useClipboardCopy();
  const markdownCopy = useClipboardCopy();
  const boxRef = useRef<HTMLDivElement>(null);

  // ---------------------------------------------
  // The markdown export
  // ---------------------------------------------
  // Fetched when the menu opens, not when the row is clicked: the clipboard
  // hook writes at once, and a write that waits on a fetch first has left
  // the click's user gesture behind, which Safari refuses. Opening the menu
  // is itself a gesture. The row stays disabled until the text is in hand,
  // and a failed fetch clears the in-flight marker so the next open retries.
  const [markdown, setMarkdown] = useState<string | null>(null);
  const markdownRequest = useRef<Promise<void> | null>(null);

  const prefetchMarkdown = () => {
    if (markdown !== null || markdownRequest.current !== null) return;

    markdownRequest.current = fetch(markdownUrl)
      .then((response) => {
        if (!response.ok) throw new Error(`${response.status} for ${markdownUrl}`);

        return response.text();
      })
      .then(setMarkdown, () => {
        markdownRequest.current = null;
      });
  };

  const copyMarkdown = () => {
    if (markdown !== null) markdownCopy.copy(markdown);
  };

  // ---------------------------------------------
  // Copy React
  // ---------------------------------------------
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
    <div className={styles.actions} ref={boxRef}>
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
      {/* Two live regions, one per clipboard hook, so a markdown copy is
          announced without the Copy React button's check lighting up. */}
      <span aria-live="polite" className={styles.srOnly}>
        {COPY_ANNOUNCEMENTS[status]}
      </span>
      <span aria-live="polite" className={styles.srOnly}>
        {COPY_ANNOUNCEMENTS[markdownCopy.status]}
      </span>
      <Menu.Root
        onOpenChange={(open) => {
          if (open) prefetchMarkdown();
        }}
      >
        <Menu.Trigger aria-label="More copy options" className={styles.more}>
          <ChevronDownIcon />
        </Menu.Trigger>
        <Menu.Portal>
          {/* Anchored to the whole box rather than the chevron, so the
              menu's right edge meets the box's outer edge, which is the
              shader's edge on a wide viewport. The chevron button sits
              1px inside that edge, behind the box's border. */}
          <Menu.Positioner align="end" anchor={boxRef} side="bottom" sideOffset={6}>
            <Menu.Popup className={styles.popup}>
              {/* Each row is its own action and runs on click; the left
                  half of the button always means Copy React, so the menu
                  does not repeat it. The view row is a link, so it opens
                  the file the way any link opens a file. */}
              <Menu.Item className={styles.row} disabled={markdown === null} onClick={copyMarkdown}>
                Copy as markdown
              </Menu.Item>
              <Menu.LinkItem
                className={styles.row}
                href={markdownUrl}
                rel="noopener"
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

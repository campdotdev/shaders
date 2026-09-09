'use client';

/**
 * The split "Copy React" button in a component page's header, after the
 * Figma mock: a bordered box holding the copy action on the left and a
 * chevron cell on the right that opens a menu of further actions. Copy
 * React copies the demo's current props as JSX; the menu's two markdown
 * rows will copy and open the page's markdown export once it ships
 * (SHA-115). The shared
 * components/[slug] template renders it beside the title and description,
 * inside the CopySourceProvider that the demo island publishes its control
 * store into (controls/context.tsx).
 * The menu is Base UI's Menu rather than the controls' Select, because the
 * rows are actions and not a value, but it borrows the select's popup
 * pattern: portaled, offset from its trigger, and scaled in from the edge
 * nearest it.
 */
import { useRef } from 'react';

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
}

// The 12-unit copy glyph drawn on a 16px box, which is exactly the mock's
// 16px export of the same icon (every coordinate is the 12-unit path times
// four thirds).
const COPY_ICON_SIZE = 16;

export function PageActions({ componentName, siblings }: PageActionsProps) {
  const store = useCopySource();
  const { status, copy } = useClipboardCopy();
  const boxRef = useRef<HTMLDivElement>(null);

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
      <span aria-live="polite" className={styles.srOnly}>
        {COPY_ANNOUNCEMENTS[status]}
      </span>
      <Menu.Root>
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
                  does not repeat it. Both rows are disabled until the
                  markdown export ships (SHA-115): the copy row will run
                  through the same clipboard hook as Copy React, and the
                  view row becomes a Menu.LinkItem to the export in a new
                  tab. */}
              <Menu.Item className={styles.row} disabled>
                Copy as markdown
              </Menu.Item>
              <Menu.Item className={styles.row} disabled>
                View as markdown
              </Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </div>
  );
}

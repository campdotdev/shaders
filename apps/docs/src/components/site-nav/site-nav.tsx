'use client';

/**
 * The site navigation on a narrow viewport, after the Figma mock: a
 * hamburger at the right of the header row that opens a full-screen overlay
 * over the blurred page, with Docs and Examples right-aligned in large type
 * under the header row and the GitHub link at the bottom. The real header
 * paints above the overlay (site-header.module.css lifts it to z-index 1),
 * so the overlay carries no row of its own: the header's trigger is the
 * Close control while the nav is open. The header renders this beside its
 * link row and CSS shows one or the other at 40rem of the site container. A
 * Base UI Dialog rather than a Drawer: the overlay fades in over the page,
 * nothing slides from an edge or is swiped away, and Dialog brings the
 * focus trap, scroll lock, Escape, and outside-press dismissal.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRef, useState } from 'react';

import { Dialog } from '@base-ui/react/dialog';

import { GitHubIcon } from '@/components/icons/github';
import { MenuToggleIcon } from '@/components/icons/menu-toggle';
import { REPO_URL, SITE_LINKS } from '@/components/site-header/links';

import styles from './site-nav.module.css';

export function SiteNav() {
  const pathname = usePathname();
  const popupRef = useRef<HTMLDivElement>(null);

  // The pathname the nav was opened on, or null while closed. `open` is
  // derived from it, and the reset below clears it the moment the pathname
  // moves on, so any navigation closes the nav with no effect: a link click,
  // or back and forward. Without the reset a stale value would reopen the
  // nav on returning to the page it was opened on. A link to the current
  // page changes nothing, so links also close on click. Setting state during
  // render when a render input has changed is React's documented pattern for
  // this; React's page names props, but the pattern is about any input, and
  // here it is the pathname the router hook returns.
  const [openedOn, setOpenedOn] = useState<string | null>(null);

  if (openedOn !== null && openedOn !== pathname) setOpenedOn(null);

  const open = openedOn === pathname;
  const close = () => setOpenedOn(null);

  return (
    <Dialog.Root onOpenChange={(next) => setOpenedOn(next ? pathname : null)} open={open}>
      {/* One control for both states: the hamburger while closed, and
          "Close" beside an X on the same 24px box while open, when a second
          press closes. Three things make that work. The header paints above
          the overlay, so the trigger stays under the pointer. Base UI's
          useClick toggles on a repeated press of an open trigger. And its
          useDismiss counts a press within the trigger as the dialog's own,
          never an outside press, so the press is not also a dismissal.
          While the nav is open Base UI's markOthers puts aria-hidden on
          everything outside the popup, this trigger included, so the
          open-state name backs the visual label only; the sr-only Close at
          the end of the popup is what a screen reader actually uses. */}
      <Dialog.Trigger
        aria-label={open ? 'Close site navigation' : 'Open site navigation'}
        className={styles.trigger}
      >
        <span className={styles.label}>Close</span>
        <MenuToggleIcon className={styles.glyph} />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className={styles.backdrop} />
        {/* Focus goes to the popup itself on every open, so a pointer open
            paints no focus ring on Docs and a screen reader hears the
            dialog's title. Base UI's default does that for touch opens
            only and otherwise focuses the first tabbable link. */}
        <Dialog.Popup className={styles.popup} initialFocus={popupRef} ref={popupRef}>
          <Dialog.Title className={styles.srOnly}>Site navigation</Dialog.Title>
          <nav aria-label="Site" className={styles.links}>
            {SITE_LINKS.map((link) => (
              <Link className={styles.link} href={link.href} key={link.href} onClick={close}>
                {link.label}
              </Link>
            ))}
          </nav>
          <div className={styles.social}>
            <a
              aria-label="GitHub repository"
              className={styles.iconLink}
              href={REPO_URL}
              rel="noreferrer"
              target="_blank"
            >
              <GitHubIcon />
            </a>
          </div>
          {/* The close for assistive tech. The header's trigger is
              aria-hidden and outside the focus trap while the nav is open,
              so a screen reader user, including VoiceOver on a phone with no
              Escape key, would otherwise have no close. tabIndex -1 keeps a
              sighted keyboard user from tabbing onto an invisible control;
              their path is Escape or the trigger. A screen reader's virtual
              cursor still reaches it. */}
          <Dialog.Close className={styles.srOnly} tabIndex={-1}>
            Close
          </Dialog.Close>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

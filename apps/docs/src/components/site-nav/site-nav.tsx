'use client';

/**
 * The site navigation on a narrow viewport, after the Figma mock: a
 * hamburger at the right of the header row that opens a full-screen overlay
 * over the blurred page, carrying its own row of the logo and a close
 * control on the header's geometry, Docs and Examples right-aligned in
 * large type under it, and the GitHub link at the bottom. The header
 * renders this beside its link row and CSS shows one or the other at 40rem
 * of the site container. A Base UI Dialog rather than a Drawer: the overlay
 * fades in over the page, nothing slides from an edge or is swiped away,
 * and Dialog brings the focus trap, scroll lock, Escape, and close button.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRef, useState } from 'react';

import { Dialog } from '@base-ui/react/dialog';

import { CloseIcon } from '@/components/icons/close';
import { GitHubIcon } from '@/components/icons/github';
import { LogoMark } from '@/components/icons/logo-mark';
import { MenuIcon } from '@/components/icons/menu';
import { REPO_URL, SITE_LINKS } from '@/components/site-header/links';

import styles from './site-nav.module.css';

export function SiteNav() {
  const pathname = usePathname();
  const closeRef = useRef<HTMLButtonElement>(null);

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
      <Dialog.Trigger aria-label="Open site navigation" className={styles.trigger}>
        <MenuIcon />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className={styles.backdrop} />
        {/* Focus lands on Close, so Escape and Enter both dismiss at once
            and a screen reader hears where it is. */}
        <Dialog.Popup className={styles.popup} initialFocus={closeRef}>
          <Dialog.Title className={styles.srOnly}>Site navigation</Dialog.Title>
          <div className={styles.bar}>
            <Link aria-label="Shaders home" className={styles.logo} href="/" onClick={close}>
              <LogoMark />
            </Link>
            <Dialog.Close className={styles.close} ref={closeRef}>
              Close
              <CloseIcon />
            </Dialog.Close>
          </div>
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
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

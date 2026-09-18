/**
 * Site-wide navigation after the Figma mock: the logo mark on the left and
 * Docs, Examples, and a GitHub link on the right, one 56px row with no
 * divider. The root layout renders it once above every route. On the
 * components routes the SectionBanner sits directly under it, and the two
 * together make the 200px header block the mock draws, and the banner's
 * shader reaches up behind this row to fill that block. Under 40rem of the
 * site container the link row and search hide and a hamburger opens the
 * same links as a full-screen nav (site-nav/).
 */
import Link from 'next/link';

import { GitHubIcon } from '@/components/icons/github';
import { LogoMark } from '@/components/icons/logo-mark';
import { SearchBar } from '@/components/SearchBar';
import { SiteNav } from '@/components/site-nav/site-nav';

import { REPO_URL, SITE_LINKS } from './links';
import styles from './site-header.module.css';

export function SiteHeader() {
  return (
    <header className={`site-gutter ${styles.header}`} data-pagefind-ignore="all">
      <div className={`site-container ${styles.row}`}>
        <Link aria-label="Shaders home" className={styles.logo} href="/">
          <LogoMark />
        </Link>
        <div className={styles.actions}>
          {/* Search is not in the mock. It stays here, ahead of the nav, until
              SHA-120 designs its place in the header. */}
          <SearchBar />
          <nav aria-label="Site" className={styles.nav}>
            {SITE_LINKS.map((link) => (
              <Link className={styles.link} href={link.href} key={link.href}>
                {link.label}
              </Link>
            ))}
            <a
              aria-label="GitHub repository"
              className={styles.iconLink}
              href={REPO_URL}
              rel="noreferrer"
              target="_blank"
            >
              <GitHubIcon />
            </a>
          </nav>
        </div>
        <SiteNav />
      </div>
    </header>
  );
}

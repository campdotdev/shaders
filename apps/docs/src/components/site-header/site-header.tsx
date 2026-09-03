/**
 * Site-wide navigation after the Figma mock: the logo mark on the left and
 * Docs, Examples, and a GitHub link on the right, one 56px row with no
 * divider. The root layout renders it once above every route. On the
 * components routes the SectionBanner sits directly under it, and the two
 * together make the 200px header block the mock draws.
 */
import Link from 'next/link';

import { GitHubIcon } from '@/components/icons/github';
import { LogoMark } from '@/components/icons/logo-mark';
import { SearchBar } from '@/components/SearchBar';

import styles from './site-header.module.css';

const REPO_URL = 'https://github.com/campdotdev/shaders';

export function SiteHeader() {
  return (
    <header className={styles.header} data-pagefind-ignore="all">
      <Link aria-label="Shaders home" className={styles.logo} href="/">
        <LogoMark />
      </Link>
      <div className={styles.actions}>
        {/* Search is not in the mock. It stays here, ahead of the nav, until
            SHA-120 designs its place in the header. */}
        <SearchBar />
        <nav aria-label="Site" className={styles.nav}>
          {/* Docs lands on the components index until a documentation home
              exists; Examples points at recipes, the nearest thing to
              examples the site has today. */}
          <Link className={styles.link} href="/components">
            Docs
          </Link>
          <Link className={styles.link} href="/recipes">
            Examples
          </Link>
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
    </header>
  );
}

/**
 * The site-wide links, in one place so the header's link row and the
 * narrow-viewport nav (site-nav/) can never disagree. Docs lands on the
 * components index until a documentation home exists (SHA-133), and
 * Examples is a placeholder page until SHA-135 designs it.
 */
export const SITE_LINKS = [
  { label: 'Docs', href: '/components' },
  { label: 'Examples', href: '/examples' },
] as const;

export const REPO_URL = 'https://github.com/campdotdev/shaders';

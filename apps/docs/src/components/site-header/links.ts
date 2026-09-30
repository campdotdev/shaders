/**
 * The site-wide links, in one place so the header's link row and the
 * narrow-viewport nav (site-nav/) can never disagree. Docs lands on the
 * docs home. Examples left for launch and comes back once it has a design
 * (SHA-178).
 */
import { DOCS_HOME_URL } from '@/content/nav.config';

export const SITE_LINKS = [{ label: 'Docs', href: DOCS_HOME_URL }] as const;

export const REPO_URL = 'https://github.com/campdotdev/shaders';

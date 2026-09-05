import { describe, expect, it } from 'vitest';

import { getDocsNavTree, getDocsPrevNext, getDocsSidebarTree } from './nav';
import { getMdxDocsPages } from './source';
import type { ResolvedNavGroup } from './types';

function urlsIn(group: ResolvedNavGroup): string[] {
  return group.items.flatMap((item) => ('items' in item ? urlsIn(item) : [item.url]));
}

// Each docs layout renders one sidebar section, so a page's Previous and
// Next links have to stay inside the section the reader is looking at.
// Crossing into another section would land them on a page whose sidebar
// replaces the one they were browsing.
describe('getDocsPrevNext', () => {
  it('never pages a docs-section page into the components or primitives sections', async () => {
    const pages = await getMdxDocsPages();
    const docsUrls = new Set((await getDocsSidebarTree('docs')).flatMap(urlsIn));

    for (const page of pages) {
      if (!docsUrls.has(page.url)) continue;
      const { prev, next } = await getDocsPrevNext(page);

      if (prev) expect(docsUrls, `${page.url} prev ${prev.url}`).toContain(prev.url);
      if (next) expect(docsUrls, `${page.url} next ${next.url}`).toContain(next.url);
    }
  });

  it('starts the first guide from the end of Overview, not from the last primitive', async () => {
    const pages = await getMdxDocsPages();
    const animation = pages.find((page) => page.url === '/guides/animation');

    expect(animation).toBeDefined();
    const { prev } = await getDocsPrevNext(animation!);
    const tree = await getDocsNavTree();

    expect(tree.map((group) => group.label)).toContain('Primitives');
    expect(prev?.url.startsWith('/primitives')).toBe(false);
  });
});

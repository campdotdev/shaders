import GithubSlugger from 'github-slugger';
import { toString } from 'mdast-util-to-string';
import remarkMdx from 'remark-mdx';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';

import type { DocsHeading } from './types';

export function extractHeadings(mdx: string): DocsHeading[] {
  const tree = unified().use(remarkParse).use(remarkMdx).parse(mdx);
  const slugger = new GithubSlugger();
  const headings: DocsHeading[] = [];

  visit(tree, 'heading', (node) => {
    if (node.depth !== 2 && node.depth !== 3) return;
    const text = toString(node);

    headings.push({
      id: slugger.slug(text),
      text,
      depth: node.depth,
    });
  });

  return headings;
}

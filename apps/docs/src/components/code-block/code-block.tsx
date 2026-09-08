/**
 * Server-rendered syntax-highlighted code block. Shiki turns the source
 * string into styled HTML at build time (the site is a static export), so no
 * highlighting JavaScript ships to the client. The colors are `var(--code-*)`
 * references from lib/code-theme.ts, resolved by the tokens in globals.css.
 * A line wider than the block scrolls sideways inside the shared ScrollArea.
 * Used by the component pages' Usage section and props table.
 */
import { ScrollArea } from '@/components/scroll-area/scroll-area';
import { CODE_THEME_NAME } from '@/lib/code-theme';
import { type CodeLang, getHighlighter } from '@/lib/shiki';

import styles from './code-block.module.css';

interface CodeBlockProps {
  source: string;
  lang?: CodeLang;
}

export async function CodeBlock({ source, lang = 'tsx' }: CodeBlockProps) {
  const highlighter = await getHighlighter();
  const html = highlighter.codeToHtml(source, {
    lang,
    theme: CODE_THEME_NAME,
    // Shiki makes every <pre> a tab stop so a keyboard can scroll it. The
    // ScrollArea's viewport already is one whenever the code overflows, so
    // keeping Shiki's would give each block two.
    transformers: [
      {
        pre(node) {
          delete node.properties.tabindex;
        },
      },
    ],
  });

  return (
    <div className={styles.codeBlock}>
      <ScrollArea orientation="horizontal" viewportClassName={styles.viewport}>
        <div dangerouslySetInnerHTML={{ __html: html }} />
      </ScrollArea>
    </div>
  );
}

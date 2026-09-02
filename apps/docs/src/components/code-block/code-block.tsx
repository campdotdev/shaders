/**
 * Server-rendered syntax-highlighted code block. Shiki turns the source
 * string into styled HTML at build time (the site is a static export), so no
 * highlighting JavaScript ships to the client. The colors are `var(--code-*)`
 * references from lib/code-theme.ts, resolved by the tokens in globals.css.
 * Used by the component pages' Usage section and props table, and the
 * primitives and recipes reference pages.
 */
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
  });

  return (
    <div className={styles.codeBlock}>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

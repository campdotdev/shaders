import { createHighlighter, type Highlighter } from 'shiki';

import { CODE_THEME } from './code-theme';

const SHIKI_LANGS = ['tsx', 'ts', 'bash', 'json'] as const;

export type CodeLang = (typeof SHIKI_LANGS)[number];

let highlighterPromise: Promise<Highlighter> | null = null;

export function getHighlighter(): Promise<Highlighter> {
  highlighterPromise ??= createHighlighter({
    themes: [CODE_THEME],
    langs: [...SHIKI_LANGS],
  });

  return highlighterPromise;
}

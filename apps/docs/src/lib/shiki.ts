import { createHighlighter, type Highlighter } from 'shiki';

const SHIKI_LANGS = ['tsx', 'ts', 'bash', 'json'] as const;

export type CodeLang = (typeof SHIKI_LANGS)[number];

let highlighterPromise: Promise<Highlighter> | null = null;

export function getHighlighter(): Promise<Highlighter> {
  highlighterPromise ??= createHighlighter({
    themes: ['github-dark'],
    langs: [...SHIKI_LANGS],
  });

  return highlighterPromise;
}

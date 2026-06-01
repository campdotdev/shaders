import { createHighlighter, type Highlighter } from 'shiki'

// Languages preloaded into the highlighter. Shared with CodeBlock so the
// `lang` prop union can't drift from what's actually loaded.
export const SHIKI_LANGS = ['tsx', 'ts', 'bash', 'json'] as const
export type CodeLang = (typeof SHIKI_LANGS)[number]

// Singleton highlighter — created once per server runtime and reused across
// all CodeBlock renders. Re-creating the highlighter per request is expensive
// (it lazy-loads grammars and themes) and would dominate page render time.
let highlighterPromise: Promise<Highlighter> | null = null

export function getHighlighter(): Promise<Highlighter> {
  highlighterPromise ??= createHighlighter({
    themes: ['github-light', 'github-dark'],
    langs: [...SHIKI_LANGS],
  })

  return highlighterPromise
}

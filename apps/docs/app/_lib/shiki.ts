import { createHighlighter, type Highlighter } from 'shiki'

// Singleton highlighter — created once per server runtime and reused across
// all CodeBlock renders. Re-creating the highlighter per request is expensive
// (it lazy-loads grammars and themes) and would dominate page render time.
let highlighterPromise: Promise<Highlighter> | null = null

export function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ['github-light', 'github-dark'],
      langs: ['tsx', 'ts', 'bash', 'json'],
    })
  }
  return highlighterPromise
}

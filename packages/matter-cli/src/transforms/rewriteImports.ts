/**
 * Rewrite import specifiers in a TS/TSX source string per a prefix-match
 * alias map. Each alias key is treated as a literal prefix; if a specifier
 * starts with the key, the prefix is replaced with the value.
 *
 * v1's Tier 1 components don't actually use any internal aliases — every
 * import resolves to a published npm package (`@lovo/matter`,
 * `@lovo/matter-react`, `react`, `three`). The synthetic test fixture
 * imports `@matter-internal/lib` to exercise this code path. When future
 * components do share internal utilities, this rewriter is what shapes
 * those imports per the user's project layout.
 *
 * Longer alias keys win over shorter ones (so `@matter-internal/` beats
 * `@/` when both match).
 */
export function rewriteImports(source: string, aliases: Record<string, string>): string {
  const sortedAliases = Object.entries(aliases).sort(([a], [b]) => b.length - a.length)
  if (sortedAliases.length === 0) return source

  // Match `from '...'` / `from "..."` / `import('...')` / `import("...")`.
  const importRe = /(\bfrom\s+|\bimport\s*\(\s*)(['"])([^'"]+)\2/g

  return source.replace(importRe, (full, lead: string, quote: string, spec: string) => {
    for (const [key, value] of sortedAliases) {
      if (spec.startsWith(key)) {
        return `${lead}${quote}${value}${spec.slice(key.length)}${quote}`
      }
    }
    return full
  })
}

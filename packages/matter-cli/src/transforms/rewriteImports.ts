// Copied source must resolve imports inside the USER's project, not the
// Matter monorepo. This transform maps import specifiers through the
// aliases in matter.config.json: every specifier starting with an alias key
// gets that prefix swapped for the configured value, in both static
// (`from '...'`) and dynamic (`import('...')`) forms. Relative imports and
// npm package names match no alias key and pass through untouched.

export function rewriteImports(source: string, aliases: Record<string, string>): string {
  // Longest key first, so with keys like '@/' and '@/lib/' the more specific
  // mapping wins instead of whichever came first in the config.
  const sortedAliases = Object.entries(aliases).sort(([a], [b]) => b.length - a.length);

  if (sortedAliases.length === 0) return source;

  // Matches the quoted specifier after `from` or `import(`; the back-
  // reference (\2) keeps quote style intact.
  const importRe = /(\bfrom\s+|\bimport\s*\(\s*)(['"])([^'"]+)\2/g;

  return source.replace(importRe, (full, lead: string, quote: string, spec: string) => {
    for (const [key, value] of sortedAliases) {
      if (spec.startsWith(key)) {
        return `${lead}${quote}${value}${spec.slice(key.length)}${quote}`;
      }
    }

    return full;
  });
}

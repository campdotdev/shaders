export function rewriteImports(source: string, aliases: Record<string, string>): string {
  const sortedAliases = Object.entries(aliases).sort(([a], [b]) => b.length - a.length);

  if (sortedAliases.length === 0) return source;

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

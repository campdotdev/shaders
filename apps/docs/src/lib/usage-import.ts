/**
 * Builds the import line shown above each Usage snippet on the component
 * pages. The names are read out of the snippet's JSX tags rather than
 * hand-authored, so the import can never drift from the code below it —
 * add a component to a snippet and its import appears automatically.
 */

/** Package components import from, per the SHA-122 npm-delivery decision. */
const PACKAGE_NAME = '@camp-dev/shaders';

export function deriveUsageImport(snippet: string): string {
  // JSX component tags start with an uppercase letter; props, string values,
  // and closing tags (the "/" breaks the match) never produce one.
  const names = new Set<string>();

  for (const match of snippet.matchAll(/<([A-Z][A-Za-z0-9]*)/g)) {
    const name = match[1];

    if (name !== undefined) names.add(name);
  }

  const sorted = [...names].sort();

  return `import { ${sorted.join(', ')} } from '${PACKAGE_NAME}'`;
}

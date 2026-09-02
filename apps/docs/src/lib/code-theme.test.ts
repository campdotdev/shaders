import { describe, expect, it } from 'vitest';

import { CODE_THEME_NAME } from './code-theme';
import { getHighlighter } from './shiki';

async function highlight(source: string, lang: 'tsx' | 'ts' = 'tsx') {
  const highlighter = await getHighlighter();

  return highlighter.codeToHtml(source, { lang, theme: CODE_THEME_NAME });
}

// Shiki folds surrounding whitespace into whichever span comes next, so a
// token is looked up by its trimmed text rather than by an exact span. A
// shiki bump that renames a scope fails here rather than quietly turning
// that role plain.
function roleOf(html: string, token: string): string | undefined {
  for (const [, role, text] of html.matchAll(
    /<span style="color:var\(--code-([a-z]+)\)">([^<]*)<\/span>/g,
  )) {
    if (text?.trim() === token) return role;
  }

  return undefined;
}

describe('CODE_THEME', () => {
  it('paints the frame with the code tokens', async () => {
    const html = await highlight('const a = 1');

    expect(html).toContain('background-color:var(--code-bg);color:var(--code-plain)');
  });

  it('colors import keywords and leaves the imported names plain', async () => {
    const html = await highlight("import { Aurora } from 'three/tsl'");

    expect(roleOf(html, 'import')).toBe('keyword');
    expect(roleOf(html, 'from')).toBe('keyword');
    expect(roleOf(html, 'Aurora')).toBe('plain');
    expect(roleOf(html, "'three/tsl'")).toBe('literal');
  });

  it('separates tag, prop, and value on a JSX line', async () => {
    const html = await highlight('<Aurora intensity={1} />');

    expect(roleOf(html, 'Aurora')).toBe('name');
    expect(roleOf(html, 'intensity')).toBe('prop');
    expect(roleOf(html, '={')).toBe('punctuation');
    expect(roleOf(html, '1')).toBe('literal');
  });

  it('treats symbol operators as structure and wordlike ones as keywords', async () => {
    const html = await highlight('const speed = typeof new Vector2()');

    expect(roleOf(html, 'const')).toBe('keyword');
    expect(roleOf(html, '=')).toBe('punctuation');
    expect(roleOf(html, 'typeof')).toBe('keyword');
    expect(roleOf(html, 'new')).toBe('keyword');
    expect(roleOf(html, 'Vector2')).toBe('name');
  });

  it('colors function calls, numbers, and booleans', async () => {
    const html = await highlight('smoothstep(0.3, true)');

    expect(roleOf(html, 'smoothstep')).toBe('name');
    expect(roleOf(html, '0.3')).toBe('literal');
    expect(roleOf(html, 'true')).toBe('literal');
  });

  it('keeps object keys plain in a props-table default', async () => {
    const html = await highlight("[{ color: 'oklch(0.7 0.1 200)', position: 0 }]", 'ts');

    expect(roleOf(html, 'color')).toBe('plain');
    expect(roleOf(html, "'oklch(0.7 0.1 200)'")).toBe('literal');
    expect(roleOf(html, '0')).toBe('literal');
  });

  it('mutes comments', async () => {
    const html = await highlight('// cursorUniform is updated by useCursor()');

    expect(roleOf(html, '// cursorUniform is updated by useCursor()')).toBe('comment');
  });
});

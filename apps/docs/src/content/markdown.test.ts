import { describe, expect, it } from 'vitest';

import type { ComponentCatalogRecord } from './catalog';
import {
  escapeTableCell,
  renderComponentMarkdown,
  renderDocMarkdown,
  renderPageMarkdown,
} from './markdown';
import type { MarkdownSources } from './markdown';
import type { PropRow } from './props';
import type { DocsPage } from './types';

const aurora: ComponentCatalogRecord = {
  url: '/components/aurora',
  label: 'Aurora',
  componentName: 'Aurora',
  description: 'Flowing ribbons of color.',
  category: 'gradients',
  order: 0,
  tags: [],
};

const rows: PropRow[] = [
  {
    name: 'speed',
    type: 'AnimatableProp<number>',
    description: 'How fast it drifts.',
    defaultValue: '0.4',
    defaultSummary: '0.4',
  },
  {
    name: 'mode',
    type: "'soft' | 'hard'",
    description: 'Edge style.',
    defaultValue: "'soft'",
    defaultSummary: "'soft'",
  },
  {
    name: 'stops',
    type: 'ColorStop[]',
    description: 'The gradient.',
    defaultValue: "[\n  { color: 'red' },\n  { color: 'blue' },\n]",
  },
  { name: 'onReady', type: '() => void', description: 'Fires once.' },
];

const snippet = '<ShaderScene>\n  <Aurora />\n</ShaderScene>';

const animation: DocsPage = {
  url: '/guides/animation',
  slugs: ['guides', 'animation'],
  sourcePath: '/content/docs/guides/animation.mdx',
  body: '\n# Animation\n\nSignals drive uniforms.\n\n<Callout>Keep it cheap.</Callout>\n',
  frontmatter: {
    title: 'Animation',
    description: 'How props animate.',
    section: 'guides',
    order: 10,
    navTitle: 'Animation',
    hidden: false,
    status: 'ready',
    tags: [],
  },
  headings: [],
};

function sources(overrides: Partial<MarkdownSources> = {}): MarkdownSources {
  return {
    getDocsPage: (slugs) =>
      Promise.resolve(slugs.join('/') === 'guides/animation' ? animation : null),
    getComponentsCatalog: () => Promise.resolve([aurora]),
    getComponentProps: () => Promise.resolve(rows),
    componentPages: { aurora: { usageSnippet: snippet } },
    ...overrides,
  };
}

describe('escapeTableCell', () => {
  it('escapes every pipe', () => {
    expect(escapeTableCell("'a' | 'b' | 'c'")).toBe("'a' \\| 'b' \\| 'c'");
  });
});

describe('renderComponentMarkdown', () => {
  const markdown = renderComponentMarkdown(aurora, { usageSnippet: snippet }, rows);

  it('opens with the title, the description, and a relative demo link', () => {
    expect(
      markdown.startsWith(
        '# Aurora\n\nFlowing ribbons of color.\n\n[Live demo](/components/aurora)\n',
      ),
    ).toBe(true);
  });

  it('derives the import line from the snippet and fences both together', () => {
    expect(markdown).toContain(
      "## Usage\n\n```tsx\nimport { Aurora, ShaderScene } from '@camp-dev/shaders'\n\n<ShaderScene>\n  <Aurora />\n</ShaderScene>\n```",
    );
  });

  it('escapes pipes inside a type cell so the column count holds', () => {
    const line = markdown.split('\n').find((candidate) => candidate.startsWith('| `mode`'));

    expect(line).toBe("| `mode` | `'soft' \\| 'hard'` | `'soft'` | Edge style. |");
  });

  it('gives every row four cells', () => {
    const tableRows = markdown.split('\n').filter((line) => line.startsWith('| `'));

    expect(tableRows).toHaveLength(4);

    for (const line of tableRows) {
      expect(line.replace(/\\\|/g, '').split('|')).toHaveLength(6);
    }
  });

  it('sends a long default below the table and says so in the cell', () => {
    expect(markdown).toContain('| `stops` | `ColorStop[]` | see below | The gradient. |');
    expect(markdown).toContain(
      "### Defaults too long for the table\n\n`stops`:\n\n```tsx\n[\n  { color: 'red' },\n  { color: 'blue' },\n]\n```",
    );
  });

  it('leaves the default cell empty for a prop with no default', () => {
    expect(markdown).toContain('| `onReady` | `() => void` |  | Fires once. |');
  });

  it('omits the long-defaults section when every default fits the table', () => {
    const short = renderComponentMarkdown(aurora, { usageSnippet: '<Aurora />' }, rows.slice(0, 2));

    expect(short).not.toContain('Defaults too long');
  });

  it('ends with one newline after the last section', () => {
    // The fixture has a long default, so the last section is its fence.
    expect(markdown.endsWith('```\n')).toBe(true);
    expect(markdown.endsWith('\n\n')).toBe(false);
  });
});

describe('renderDocMarkdown', () => {
  it('returns the body when it carries its own h1', () => {
    expect(renderDocMarkdown(animation)).toBe(
      '# Animation\n\nSignals drive uniforms.\n\n<Callout>Keep it cheap.</Callout>\n',
    );
  });

  it('adds the frontmatter title when the body has no h1', () => {
    expect(renderDocMarkdown({ ...animation, body: '\nSignals drive uniforms.\n' })).toBe(
      '# Animation\n\nSignals drive uniforms.\n',
    );
  });
});

describe('renderPageMarkdown', () => {
  it('renders a component page from the registry, the catalog, and the props', async () => {
    const markdown = await renderPageMarkdown(['components', 'aurora'], sources());

    expect(markdown).toContain('# Aurora');
    expect(markdown).toContain('| `speed` |');
  });

  it('renders a prose page', async () => {
    expect(await renderPageMarkdown(['guides', 'animation'], sources())).toContain('# Animation');
  });

  it('returns null for an unknown component, a nested component path, and an unknown doc', async () => {
    expect(await renderPageMarkdown(['components', 'nope'], sources())).toBeNull();
    expect(await renderPageMarkdown(['components', 'aurora', 'extra'], sources())).toBeNull();
    expect(await renderPageMarkdown(['guides', 'nope'], sources())).toBeNull();
  });

  it('returns null when the registry has the slug but the catalog does not', async () => {
    const missing = sources({ getComponentsCatalog: () => Promise.resolve([]) });

    expect(await renderPageMarkdown(['components', 'aurora'], missing)).toBeNull();
  });
});

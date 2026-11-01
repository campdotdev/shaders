/**
 * A composition's All props section mounts each demo's fields over the
 * component's real props, so every path they write must start with a prop
 * the component has. The demos load three, which this Node vitest can't, so
 * it reads their source with the TypeScript compiler, as props.ts does.
 */
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { POSITIONED_STOP_COMPONENTS } from '@/compositions/store';
import { getComponentsCatalog } from '@/content/catalog';
import { COMPONENTS } from '@/content/components';
import { getComponentProps } from '@/content/props';

/**
 * Every `path` attribute and every `setProp('…')` call in a demo's source,
 * skipping a ListInput's rows, whose paths are relative to a row.
 */
function collectWrittenPaths(source: string): string[] {
  const file = ts.createSourceFile(
    'demo.tsx',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const paths: string[] = [];

  const visit = (node: ts.Node) => {
    if (ts.isJsxAttribute(node) && node.name.getText(file) === 'path') {
      const { initializer } = node;

      if (initializer !== undefined && ts.isStringLiteral(initializer)) {
        paths.push(initializer.text);
      }
    }

    if (
      ts.isCallExpression(node) &&
      node.expression.getText(file) === 'setProp' &&
      node.arguments[0] !== undefined &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      paths.push(node.arguments[0].text);
    }

    // A ListInput's own path attribute is top-level, but its children render
    // its rows, where paths are relative to the row.
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(file) === 'ListInput') {
      node.openingElement.attributes.properties.forEach(visit);

      return;
    }

    ts.forEachChild(node, visit);
  };

  visit(file);

  return paths;
}

describe('demo fields', () => {
  it.each(Object.keys(COMPONENTS))('%s writes only its own props', async (slug) => {
    const source = await readFile(new URL(`./${slug}/demo.tsx`, import.meta.url), 'utf8');
    const props = new Set((await getComponentProps(slug)).map(({ name }) => name));
    const paths = collectWrittenPaths(source);

    expect(paths.length, `${slug} has no fields`).toBeGreaterThan(0);

    for (const path of paths) {
      const [prop = ''] = path.split('.');

      expect(props, `${slug} writes "${path}"`).toContain(prop);
    }
  });
});

// A composition's store writes out the stop positions the library spaces
// evenly, but only for the components in POSITIONED_STOP_COMPONENTS, because
// only their fields show a position. A demo that gains or drops a position
// field has to change that list too.
describe('stop positions', () => {
  it('lists exactly the components whose fields edit a stop position', async () => {
    const editing = await Promise.all(
      (await getComponentsCatalog()).map(async ({ url, componentName }) => {
        const source = await readFile(
          new URL(`.${url.replace('/components', '')}/demo.tsx`, import.meta.url),
          'utf8',
        );

        return source.includes('path="position"') ? [componentName] : [];
      }),
    );

    expect(editing.flat().sort()).toEqual([...POSITIONED_STOP_COMPONENTS].sort());
  });
});

/**
 * Every path a demo's fields write must start with a prop the component has,
 * because a composition's All props section mounts those fields over the
 * component's real props, and the copied file prints whatever they write. A
 * demo-only field, such as a center split into centerX and centerY, would
 * write a prop no component takes.
 *
 * The demos import three, which the docs' Node vitest can't load, so this
 * reads each demo's source with the TypeScript compiler, the way props.ts
 * reads the component wrappers. It collects every `path` attribute and every
 * `setProp('…')` call, and skips what sits inside a ListInput's rows, whose
 * paths are relative to a row of that ListInput's own path.
 */
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { COMPONENTS } from '@/content/components';
import { getComponentProps } from '@/content/props';

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

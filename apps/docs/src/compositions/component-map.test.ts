/**
 * Keeps the component map in step with the docs' own list of components.
 * The map imports every component, which loads three/webgpu, and the docs'
 * vitest runs in plain Node, where three throws at module load. So the test
 * reads the map's source with the TypeScript compiler, the way props.ts
 * reads the component wrappers, and compares its keys with each catalog
 * record's componentName, which content/catalog.ts derives from the slug.
 */
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { getComponentsCatalog } from '@/content/catalog';

async function readComponentMapKeys(): Promise<string[]> {
  const source = await readFile(new URL('./component-map.ts', import.meta.url), 'utf8');
  const file = ts.createSourceFile('component-map.ts', source, ts.ScriptTarget.Latest, true);

  for (const statement of file.statements) {
    if (!ts.isVariableStatement(statement)) continue;

    for (const declaration of statement.declarationList.declarations) {
      const { name, initializer } = declaration;

      if (ts.isIdentifier(name) && name.text === 'COMPONENT_MAP' && initializer !== undefined) {
        if (!ts.isObjectLiteralExpression(initializer)) {
          throw new Error('COMPONENT_MAP is no longer an object literal');
        }

        return initializer.properties.map((property) => {
          if (property.name === undefined || !ts.isIdentifier(property.name)) {
            throw new Error(`COMPONENT_MAP has a key this test can't read: ${property.getText()}`);
          }

          return property.name.text;
        });
      }
    }
  }

  throw new Error('component-map.ts no longer declares COMPONENT_MAP');
}

describe('COMPONENT_MAP', () => {
  it('maps every component in COMPONENTS by its export name, and nothing else', async () => {
    const catalogNames = (await getComponentsCatalog()).map((record) => record.componentName);

    expect((await readComponentMapKeys()).sort()).toEqual(catalogNames.sort());
  });
});

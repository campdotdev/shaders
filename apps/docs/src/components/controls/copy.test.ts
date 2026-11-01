// @vitest-environment node
/**
 * The page header's Copy React output. It prints through the composition
 * generator's printer (lib/print-jsx.ts), so a component page and a
 * composition copy the same prop value in the same Prettier shape.
 */
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { format, resolveConfig } from 'prettier';
import { describe, expect, it } from 'vitest';

import { formatJsx } from './copy';

async function prettierFormat(source: string): Promise<string> {
  // A file name beside this one, so Prettier resolves the repo's config and
  // parses as TSX. Nothing is written there.
  const filepath = join(fileURLToPath(new URL('.', import.meta.url)), 'prettier-check.tsx');
  const options = await resolveConfig(filepath);

  return format(source, { ...options, filepath });
}

describe('formatJsx', () => {
  it('keeps an element that fits on one line', () => {
    expect(
      formatJsx(
        { componentName: 'Grain' },
        { intensity: 0.30000000000000004, color: 'red', animate: true },
      ),
    ).toBe(
      [
        '<ShaderScene>',
        '  <Grain intensity={0.3} color="red" animate={true} />',
        '</ShaderScene>',
      ].join('\n'),
    );
  });

  it('prints the siblings ahead of the component', () => {
    expect(
      formatJsx({ componentName: 'Vignette', siblings: ['<LinearGradient />'] }, { intensity: 1 }),
    ).toBe(
      [
        '<ShaderScene>',
        '  <LinearGradient />',
        '  <Vignette intensity={1} />',
        '</ShaderScene>',
      ].join('\n'),
    );
  });

  // MeshGradient's two palettes are an array of arrays, which Prettier
  // always breaks. The element then breaks one attribute per line, and
  // `speed` stays on its own line unbroken.
  it("breaks MeshGradient's palettes and keeps its speed on one line", async () => {
    const jsx = formatJsx(
      { componentName: 'MeshGradient' },
      {
        speed: 2,
        palettes: [
          ['#0f766e', '#15803d', '#0369a1', '#1d4ed8'],
          ['#b45309', '#c2410c', '#b91c1c', '#a21caf'],
        ],
      },
    );

    expect(jsx).toBe(
      [
        '<ShaderScene>',
        '  <MeshGradient',
        '    speed={2}',
        '    palettes={[',
        "      ['#0f766e', '#15803d', '#0369a1', '#1d4ed8'],",
        "      ['#b45309', '#c2410c', '#b91c1c', '#a21caf'],",
        '    ]}',
        '  />',
        '</ShaderScene>',
      ].join('\n'),
    );
    // Prettier adds the statement's semicolon and leaves the rest alone.
    expect(`${jsx};\n`).toBe(await prettierFormat(jsx));
  });

  // A forced break also breaks everything around it, up to the element,
  // however short the line would be.
  it.each([
    [
      'an array of arrays',
      {
        palettes: [
          ['#000', '#111'],
          ['#222', '#333'],
        ],
      },
    ],
    [
      'one inside an object',
      {
        field: {
          rows: [
            [1, 2],
            [3, 4],
          ],
        },
      },
    ],
    [
      'one inside a list of objects',
      {
        lines: [
          {
            width: 1,
            rows: [
              [1, 2],
              [3, 4],
            ],
          },
        ],
      },
    ],
  ])('breaks the element around %s, as Prettier does', async (_case, params) => {
    const jsx = formatJsx({ componentName: 'Grain' }, params);

    expect(`${jsx};\n`).toBe(await prettierFormat(jsx));
  });

  it('leaves out a prop the snapshot holds as undefined', () => {
    expect(formatJsx({ componentName: 'Grain' }, { intensity: 1, color: undefined })).toBe(
      ['<ShaderScene>', '  <Grain intensity={1} />', '</ShaderScene>'].join('\n'),
    );
  });

  it('moves a string holding a double quote into braces', () => {
    expect(formatJsx({ componentName: 'Grain' }, { label: 'a "b"' })).toContain(`label={'a "b"'}`);
  });

  it('escapes quotes and line breaks inside nested strings', () => {
    const jsx = formatJsx({ componentName: 'Grain' }, { stops: [{ name: "it's\nhere" }] });

    expect(jsx).toContain(`name: "it's\\nhere"`);
  });
});

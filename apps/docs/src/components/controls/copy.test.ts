// @vitest-environment node
/**
 * The page header's Copy React output. Strings print the way the
 * composition generator prints them, so a value holding a quote or a line
 * break still pastes as valid JSX.
 */
import { describe, expect, it } from 'vitest';

import { formatJsx } from './copy';

describe('formatJsx', () => {
  it('prints numbers, booleans, and plain strings', () => {
    expect(
      formatJsx(
        { componentName: 'Grain' },
        { intensity: 0.30000000000000004, color: 'red', animate: true },
      ),
    ).toBe(
      [
        '<ShaderScene>',
        '  <Grain',
        '    intensity={0.3}',
        '    color="red"',
        '    animate={true}',
        '  />',
        '</ShaderScene>',
      ].join('\n'),
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

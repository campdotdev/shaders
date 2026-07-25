/**
 * Turns a params snapshot into the two things the panel's copy buttons hand
 * out: a ready-to-paste JSX block and a plain params object. This works because
 * each page's params object mirrors its component's real prop shape — every
 * page used to hand-write both strings and repeat each prop name three times.
 */

export interface CopyConfig {
  /** Component name as written in JSX, e.g. 'WaveLines'. */
  componentName: string;
  /** Extra JSX rendered inside <ShaderScene> before the component, e.g. '<LinearGradient />'. */
  siblings?: readonly string[];
}

const DECIMAL_PLACES = 4;

const formatNumber = (value: number) =>
  String(Math.round(value * 10 ** DECIMAL_PLACES) / 10 ** DECIMAL_PLACES);

/** A value as it appears inside a params object literal (single-quoted strings). */
function formatValue(value: unknown, indent: string): string {
  if (typeof value === 'number') return formatNumber(value);
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'string') return `'${value}'`;

  if (Array.isArray(value)) {
    const items = value.map((item) => formatValue(item, `${indent}  `));
    // Tuples of plain values stay on one line; anything holding objects or
    // nested arrays breaks so a long stop list stays readable.
    const isFlat = value.every((item) => typeof item !== 'object' || item === null);

    if (isFlat) return `[${items.join(', ')}]`;

    return `[\n${items.map((item) => `${indent}  ${item}`).join(',\n')},\n${indent}]`;
  }

  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value).map(
      ([key, entryValue]) => `${key}: ${formatValue(entryValue, `${indent}  `)}`,
    );

    return `{ ${entries.join(', ')} }`;
  }

  return String(value);
}

/** The params object, one prop per line, in declaration order. */
export function formatParams(params: object): string {
  const lines = Object.entries(params).map(
    ([key, value]) => `  ${key}: ${formatValue(value, '  ')},`,
  );

  return `{\n${lines.join('\n')}\n}`;
}

/** A JSX attribute: strings use quotes, everything else braces. */
function formatAttribute(key: string, value: unknown, indent: string): string {
  if (typeof value === 'string') return `${indent}${key}="${value}"`;

  return `${indent}${key}={${formatValue(value, indent)}}`;
}

export function formatJsx({ componentName, siblings = [] }: CopyConfig, params: object): string {
  const attributes = Object.entries(params).map(([key, value]) =>
    formatAttribute(key, value, '    '),
  );
  const before = siblings.map((sibling) => `  ${sibling}`).join('\n');

  return [
    '<ShaderScene>',
    ...(before.length > 0 ? [before] : []),
    `  <${componentName}`,
    ...attributes,
    '  />',
    '</ShaderScene>',
  ].join('\n');
}

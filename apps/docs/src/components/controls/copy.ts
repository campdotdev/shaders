/**
 * Turns a params snapshot into the ready-to-paste JSX block that the page
 * header's Copy React menu hands out. This works because each page's params
 * object mirrors its component's real prop shape. The component prints
 * through lib/print-jsx.ts, the composition generator's printer, so its
 * props break the way Prettier and a composition's copied file break them.
 */
import { INDENT, printElement } from '@/lib/print-jsx';

export interface CopyConfig {
  /** Component name as written in JSX, e.g. 'WaveLines'. */
  componentName: string;
  /** Extra JSX rendered inside <ShaderScene> before the component, e.g. '<LinearGradient />'. */
  siblings?: readonly string[];
}

export function formatJsx({ componentName, siblings = [] }: CopyConfig, params: object): string {
  // A prop left undefined is one hand-written JSX would leave out.
  const props = Object.entries(params).filter(([, value]) => value !== undefined);

  return [
    '<ShaderScene>',
    ...siblings.map((sibling) => `${INDENT}${sibling}`),
    printElement(componentName, props, INDENT),
    '</ShaderScene>',
  ].join('\n');
}

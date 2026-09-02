/**
 * API Reference rows for a component page: one accordion row per prop showing
 * the name, a one-line default, and the type, expanding to the full
 * description plus the type and default as code. Rows come from
 * content/props.ts, which extracts them from the registry wrapper at build
 * time. Layout follows the Figma "api section" mock.
 */
import { Accordion } from '@base-ui/react/accordion';

import { CodeBlock } from '@/components/code-block/code-block';
import { ChevronDownIcon } from '@/components/icons/chevron-down';
import type { PropRow } from '@/content/props';
import { splitInlineCode } from '@/lib/inline-code';

import styles from './props-table.module.css';

interface PropsTableProps {
  rows: PropRow[];
}

export function PropsTable({ rows }: PropsTableProps) {
  return (
    <Accordion.Root className={styles.table} hiddenUntilFound multiple>
      <div aria-hidden="true" className={styles.head}>
        <span>Props</span>
        <span>Default</span>
        <span>Type</span>
      </div>
      {rows.map((row) => (
        <Accordion.Item className={styles.row} key={row.name} value={row.name}>
          <Accordion.Header className={styles.header}>
            <Accordion.Trigger className={styles.trigger}>
              <span className={styles.name}>{row.name}</span>
              <span className={styles.default}>
                <DefaultSummary row={row} />
              </span>
              <span className={styles.type}>
                <code>{row.type}</code>
              </span>
              <ChevronDownIcon className={styles.chevron} />
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel className={styles.panel}>
            <dl className={styles.details}>
              <dt>Description</dt>
              <dd className={styles.description}>
                <Description text={row.description} />
              </dd>
              <dt>Type</dt>
              <dd>
                <CodeBlock lang="ts" source={row.type} />
              </dd>
              {row.defaultValue === undefined ? null : (
                <>
                  <dt>Default</dt>
                  <dd>
                    <CodeBlock lang="ts" source={row.defaultValue} />
                  </dd>
                </>
              )}
            </dl>
          </Accordion.Panel>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  );
}

// JSDoc marks code spans with backticks; render them as <code> so `center`
// and `oklch()` read as identifiers rather than punctuation.
function Description({ text }: { text: string }) {
  return splitInlineCode(text).map((segment, index) =>
    segment.code ? <code key={index}>{segment.text}</code> : segment.text,
  );
}

// The collapsed row shows the default only when it fits on one line. A large
// default (a stops array) gets a bracket hint so the reader knows to expand,
// and a prop with no default gets a dash with no chip around it.
function DefaultSummary({ row }: { row: PropRow }) {
  if (row.defaultSummary !== undefined) return <code>{row.defaultSummary}</code>;
  if (row.defaultValue !== undefined) return <code>[…]</code>;

  return <span className={styles.none}>—</span>;
}

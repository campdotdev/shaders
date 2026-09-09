import type { HTMLAttributes, ReactNode } from 'react';

import { ScrollArea } from '@/components/scroll-area/scroll-area';

function Callout({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        border: '1px solid color-mix(in oklab, currentColor 25%, transparent)',
        borderRadius: '0.5rem',
        padding: '0.875rem 1rem',
        margin: '1.25rem 0',
        background: 'color-mix(in oklab, currentColor 6%, transparent)',
      }}
    >
      {children}
    </div>
  );
}

function Steps({ children }: { children: ReactNode }) {
  return (
    <ol
      style={{
        paddingLeft: '1.5rem',
        margin: '1.25rem 0',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
      }}
    >
      {children}
    </ol>
  );
}

// A fenced code block. The outer div carries the block's margin and rounds
// the ScrollArea's clip, and the <pre> is as wide as its longest line and
// never narrower than the block, so its background covers a line that
// scrolls sideways.
function Pre(props: HTMLAttributes<HTMLPreElement>) {
  return (
    <div style={{ margin: '1rem 0', borderRadius: '0.5rem', overflow: 'hidden' }}>
      <ScrollArea orientation="horizontal">
        <pre
          {...props}
          style={{
            width: 'max-content',
            minWidth: '100%',
            background: 'color-mix(in oklab, currentColor 8%, transparent)',
            padding: '1rem',
            margin: 0,
            fontSize: '0.875rem',
            ...props.style,
          }}
        />
      </ScrollArea>
    </div>
  );
}

// A single components map is the shape next-mdx-remote's MDXRemote consumes —
// splitting it into per-component exports would just move the object literal
// to every call site. Fast Refresh falling back to a full reload on edits to
// this file is the accepted cost.
// react-doctor-disable-next-line react-doctor/only-export-components
export const mdxComponents = {
  Callout,
  Steps,
  pre: Pre,
};

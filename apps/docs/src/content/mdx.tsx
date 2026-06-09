import type { HTMLAttributes, ReactNode } from 'react';

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

function Pre(props: HTMLAttributes<HTMLPreElement>) {
  return (
    <pre
      {...props}
      style={{
        background: 'color-mix(in oklab, currentColor 8%, transparent)',
        padding: '1rem',
        borderRadius: '0.5rem',
        overflow: 'auto',
        margin: '1rem 0',
        fontSize: '0.875rem',
        ...props.style,
      }}
    />
  );
}

export const mdxComponents = {
  Callout,
  Steps,
  pre: Pre,
};
